// Ported from src/shared/managed-file.js (JS original) — generic TypeScript
// port, same design 1:1: in-memory cache, atomic writes, max-interval flush
// scheduling, checkpoint/recovery, dormant audit/backup hooks, graceful
// shutdown. See the JS original's header comment for the full feature list;
// not repeated here to avoid drifting out of sync with two copies of the
// same prose.

import fsp from 'node:fs/promises';
import path from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFn = (level: LogLevel, msg: string, meta?: unknown) => void;

export interface AuditResult {
	ok: boolean;
	reason?: string;
}
export type AuditFn<T> = (prevMetrics: unknown, nextValue: T) => AuditResult;
export type AuditMetricsFn<T> = (value: T) => unknown;

export interface ManagedFileOptions<T> {
	filePath: string;
	name: string;
	defaultValue: () => T;
	parse?: (str: string) => T;
	serialize?: (value: T) => string;
	audit?: AuditFn<T> | null;
	auditMetrics?: AuditMetricsFn<T> | null;
	quarantineKeep?: number;
	maxFlushIntervalMs?: number;
	retryDelays?: number[];
	enableCheckpoint?: boolean;
	backupDir?: string | null;
	backupIntervalMs?: number;
	backupKeep?: number;
	log?: LogFn;
}

export interface ManagedFileStats {
	name: string;
	filePath: string;
	loaded: boolean;
	loadedAt: string | null;
	loadSource: string | null;
	recoveryUsedOnLoad: boolean;
	dirty: boolean;
	pendingFlushInMs: number | null;
	lastFlushedAt: string | null;
	writeCount: number;
	auditViolationCount: number;
	lastBackupAt: string | null;
	backupCount: number;
	prevMetrics: unknown;
}

function errCode(err: unknown): string | undefined {
	return (err as NodeJS.ErrnoException)?.code;
}

function errMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export class ManagedFile<T> {
	private _filePath: string;
	private _name: string;

	private _parse: (str: string) => T;
	private _serialize: (value: T) => string;
	private _defaultValue: () => T;

	private _audit: AuditFn<T> | null;
	private _auditMetrics: AuditMetricsFn<T> | null;
	private _quarantineKeep: number;

	private _maxFlushIntervalMs: number;
	private _retryDelays: number[];

	private _enableCheckpoint: boolean;

	private _backupDir: string | null;
	private _backupIntervalMs: number;
	private _backupKeep: number;

	private _logFn: LogFn;

	private _value: T | null = null;
	private _loaded = false;
	private _loadPromise: Promise<void> | null = null;

	private _createdAt = Date.now();
	private _dirty = false;
	private _flushTimer: ReturnType<typeof setTimeout> | null = null;
	private _nextFlushAt = 0;
	private _lastFlushedAt = 0;
	private _lastBackupAt = 0;
	private _prevMetrics: unknown = null;
	private _writeChain: Promise<void> = Promise.resolve();
	private _pendingCheckpoint: Promise<void> | null = null;
	private _pendingBackup: Promise<void> | null = null;

	private _s = {
		loadedAt: null as string | null,
		loadSource: null as string | null,
		recoveryUsedOnLoad: false,
		writeCount: 0,
		auditViolationCount: 0,
		lastBackupAt: null as string | null,
		backupCount: 0
	};

	constructor(options: ManagedFileOptions<T>) {
		if (!options?.filePath) throw new Error('ManagedFile: filePath is required');
		if (!options?.name) throw new Error('ManagedFile: name is required');
		if (typeof options?.defaultValue !== 'function') {
			throw new Error('ManagedFile: defaultValue must be a factory function');
		}

		this._filePath = options.filePath;
		this._name = options.name;

		this._parse = options.parse ?? ((str: string) => JSON.parse(str) as T);
		this._serialize = options.serialize ?? ((value: T) => JSON.stringify(value, null, 4));
		this._defaultValue = options.defaultValue;

		this._audit = options.audit ?? null;
		this._auditMetrics = options.auditMetrics ?? null;
		this._quarantineKeep = options.quarantineKeep ?? 10;

		this._maxFlushIntervalMs = options.maxFlushIntervalMs ?? 60_000;
		this._retryDelays = options.retryDelays ?? [50, 100, 200, 400, 800, 1200];

		this._enableCheckpoint = options.enableCheckpoint ?? true;

		this._backupDir = options.backupDir ?? null;
		this._backupIntervalMs = options.backupIntervalMs ?? 6 * 60 * 60 * 1000;
		this._backupKeep = options.backupKeep ?? 30;

		this._logFn = options.log ?? this._defaultLogFn.bind(this);
	}

	// ── Logging ───────────────────────────────────────────────────────────────

	private _defaultLogFn(level: LogLevel, msg: string, meta?: unknown) {
		const text = `[ManagedFile ${this._name}] ${msg}`;
		const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
		meta !== undefined ? out(text, meta) : out(text);
	}

	private _info(msg: string, meta?: unknown) {
		this._logFn('info', msg, meta);
	}
	private _warn(msg: string, meta?: unknown) {
		this._logFn('warn', msg, meta);
	}
	private _error(msg: string, meta?: unknown) {
		this._logFn('error', msg, meta);
	}

	// ── Derived paths ─────────────────────────────────────────────────────────

	private get _checkpointPath(): string {
		return this._filePath + '.checkpoint.json';
	}

	private _quarantinePath(): string {
		const ts = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
		const base = this._filePath.replace(/\.json$/i, '');
		return `${base}.quarantine-${ts}.json`;
	}

	// ── Load ──────────────────────────────────────────────────────────────────

	/**
	 * Load the file from disk into memory.
	 * Safe to call concurrently — all callers share the same in-flight promise.
	 * No-op if already loaded.
	 */
	async load(): Promise<void> {
		if (this._loaded) return;
		if (this._loadPromise) return this._loadPromise;

		this._loadPromise = this._doLoad().finally(() => {
			this._loadPromise = null;
		});

		return this._loadPromise;
	}

	private async _doLoad(): Promise<void> {
		let value: T;
		let source = 'main';

		// 1. Try main file
		try {
			const str = await this._readFileSafe(this._filePath);
			if (str === null) {
				// Main file absent (ENOENT). If a checkpoint is configured, try it
				// before accepting default — it may have data worth recovering.
				if (this._enableCheckpoint) {
					source = 'checkpoint';
					this._info('File not found — trying checkpoint before default');
					value = this._defaultValue();
				} else {
					value = this._defaultValue();
					source = 'default';
					this._info('File not found — starting with default value');
				}
			} else {
				value = this._parse(str);
			}
		} catch (err) {
			if (!this._enableCheckpoint) {
				// No checkpoint fallback configured — surface the error immediately.
				throw err;
			}
			this._warn(`Main file unreadable (${errMessage(err)}) — trying checkpoint`);
			source = 'checkpoint';
			value = this._defaultValue();
		}

		// 2. Try checkpoint if main file failed
		if (source === 'checkpoint') {
			try {
				const str = await this._readFileSafe(this._checkpointPath);
				if (str !== null) {
					value = this._parse(str);
					this._s.recoveryUsedOnLoad = true;
					this._warn('Loaded from checkpoint — main file was unreadable');
				} else {
					value = this._defaultValue();
					source = 'default';
					this._warn('No checkpoint found — starting with default value');
				}
			} catch (err) {
				value = this._defaultValue();
				source = 'default';
				this._warn(`Checkpoint also failed (${errMessage(err)}) — starting with default value`);
			}
		}

		this._value = value!;
		this._prevMetrics = this._auditMetrics ? this._auditMetrics(value!) : null;
		this._loaded = true;
		this._s.loadedAt = new Date().toISOString();
		this._s.loadSource = source;

		const extra = this._prevMetrics ? ` — ${JSON.stringify(this._prevMetrics)}` : '';
		this._info(`Loaded from ${source}${extra}`);

		// If no backup exists yet for this file, create one now (fire-and-forget).
		// Skipped when the file didn't exist on disk — nothing worth snapshotting.
		if (this._backupDir && source !== 'default') {
			this._ensureInitialBackup();
		}
	}

	// Scans the backup directory and triggers a backup if no files for this
	// ManagedFile instance exist yet. Runs fire-and-forget after load().
	private _ensureInitialBackup(): void {
		const base = path.basename(this._filePath, '.json');
		void (async () => {
			try {
				const entries = await fsp.readdir(this._backupDir!).catch(() => [] as string[]);
				const hasBackup = entries.some((e) => e.startsWith(`${base}-`) && e.endsWith('.json'));
				if (!hasBackup) {
					this._info('No existing backup found — creating initial backup');
					await this._doBackup(this._serialize(this._value as T));
				}
			} catch (err) {
				this._warn(`Initial backup check failed: ${errMessage(err)}`);
			}
		})();
	}

	private async _readFileSafe(filePath: string): Promise<string | null> {
		try {
			return String(await fsp.readFile(filePath));
		} catch (err) {
			if (errCode(err) === 'ENOENT') return null;
			throw err;
		}
	}

	// ── Read ──────────────────────────────────────────────────────────────────

	/** Synchronous. Returns the in-memory value. Throws if not yet loaded. */
	get(): T {
		if (!this._loaded) {
			throw new Error(`[ManagedFile ${this._name}] not loaded — call await load() first`);
		}
		return this._value as T;
	}

	// ── Write ─────────────────────────────────────────────────────────────────

	/**
	 * Update the in-memory value and schedule a flush.
	 *
	 * IMPORTANT: pass a new object, do not mutate the value returned by get().
	 * Auditing compares prevMetrics (snapshot of last written value) against
	 * newValue — this only works correctly if the old _value has not been
	 * mutated in place before set() is called.
	 *
	 * On audit failure: the rejected data is quarantined, an error is thrown,
	 * and the in-memory state is left unchanged.
	 */
	async set(newValue: T): Promise<void> {
		if (!this._loaded) {
			throw new Error(`[ManagedFile ${this._name}] not loaded — call await load() first`);
		}

		// Audit BEFORE updating _value so _value is still the previous state.
		if (this._audit && this._prevMetrics !== null) {
			const result = this._audit(this._prevMetrics, newValue);
			if (!result.ok) {
				this._s.auditViolationCount++;
				this._error(`AUDIT VIOLATION: ${result.reason}`);

				// Quarantine the rejected data (best-effort — don't let a
				// quarantine failure mask the original violation error).
				try {
					const qPath = this._quarantinePath();
					await this._atomicWrite(qPath, this._serialize(newValue));
					this._warn(`Rejected data quarantined → ${path.basename(qPath)}`);
					this._pruneQuarantines().catch(() => {});
				} catch (qErr) {
					this._error(`Failed to write quarantine file: ${errMessage(qErr)}`);
				}

				throw new Error(`[ManagedFile ${this._name}] Audit violation: ${result.reason}`);
			}
		}

		this._value = newValue;
		this._markDirty();
	}

	private _markDirty(): void {
		this._dirty = true;
		if (this._flushTimer !== null) return; // already scheduled within this window

		// If never flushed, wait the full interval before writing.
		// If we flushed recently, schedule so writes stay spaced by maxFlushIntervalMs.
		// Example: interval=60s, last flush was 5s ago → next flush in 55s.
		const delay =
			this._lastFlushedAt === 0
				? this._maxFlushIntervalMs
				: Math.max(0, this._maxFlushIntervalMs - (Date.now() - this._lastFlushedAt));

		this._nextFlushAt = Date.now() + delay;
		this._flushTimer = setTimeout(() => {
			this._flushTimer = null;
			this._nextFlushAt = 0;
			this._enqueueFlush().catch((err) => {
				this._error(`Scheduled flush failed: ${errMessage(err)}`);
			});
		}, delay);
	}

	// ── Flush ─────────────────────────────────────────────────────────────────

	/** Force an immediate write, bypassing the scheduled flush window. */
	async flush(): Promise<void> {
		if (this._flushTimer !== null) {
			clearTimeout(this._flushTimer);
			this._flushTimer = null;
		}
		if (!this._dirty) return;
		return this._enqueueFlush();
	}

	private _enqueueFlush(): Promise<void> {
		// Serialize all writes through a promise chain so concurrent flush()
		// calls never overlap on the same file.
		const next = this._writeChain.then(() => this._doFlush());
		this._writeChain = next.catch(() => {});
		return next;
	}

	private async _doFlush(): Promise<void> {
		if (!this._dirty) return;
		this._dirty = false;

		const value = this._value as T;
		const serialized = this._serialize(value);

		// Safety-net audit at flush time — catches any path that bypassed set().
		if (this._audit && this._prevMetrics !== null) {
			const result = this._audit(this._prevMetrics, value);
			if (!result.ok) {
				this._s.auditViolationCount++;
				this._error(`FLUSH AUDIT VIOLATION: ${result.reason} — real file untouched`);
				try {
					const qPath = this._quarantinePath();
					await this._atomicWrite(qPath, serialized);
					this._warn(`Quarantined flush data → ${path.basename(qPath)}`);
					this._pruneQuarantines().catch(() => {});
				} catch (qErr) {
					this._error(`Failed to write quarantine file: ${errMessage(qErr)}`);
				}
				return;
			}
		}

		// Retry loop — each attempt delegates the single-shot I/O to _atomicWrite.
		// Keeping the loop here (not inside _atomicWrite) allows tests to mock
		// _atomicWrite and observe one call per attempt.
		let writeErr: unknown;
		for (let i = 0; i <= this._retryDelays.length; i++) {
			try {
				await this._atomicWrite(this._filePath, serialized);
				writeErr = null;
				break;
			} catch (err) {
				writeErr = err;
				if (i === this._retryDelays.length) break;
				this._warn(`Write attempt ${i + 1} failed (${errMessage(err)}), retrying in ${this._retryDelays[i]} ms`);
				await new Promise((r) => setTimeout(r, this._retryDelays[i]));
			}
		}
		if (writeErr) {
			// Failed after all retries. Mark dirty so the next set() call
			// reschedules a flush attempt. The in-memory value is still correct.
			this._dirty = true;
			this._error(`Write failed after all retries: ${errMessage(writeErr)}`);
			throw writeErr;
		}

		// Successful write — update audit baseline and stats.
		if (this._auditMetrics) {
			this._prevMetrics = this._auditMetrics(value);
		}
		this._lastFlushedAt = Date.now();
		this._s.writeCount++;

		const extra = this._prevMetrics ? ` — ${JSON.stringify(this._prevMetrics)}` : '';
		this._info(`Flushed (write #${this._s.writeCount})${extra}`);

		// Write checkpoint alongside the main file (fire-and-forget — a
		// checkpoint failure is logged but must not fail the flush).
		// Track the promise so close() can await it before process exits.
		if (this._enableCheckpoint) {
			this._pendingCheckpoint = this._atomicWrite(this._checkpointPath, serialized).catch((err) => {
				this._warn(`Checkpoint write failed: ${errMessage(err)}`);
			});
		}

		// Periodic backup — only if interval has elapsed since last backup (or
		// since instance creation when never backed up).
		// Tracked the same way so close() can drain it cleanly.
		const backupRef = this._lastBackupAt || this._createdAt;
		if (this._backupDir && Date.now() - backupRef >= this._backupIntervalMs) {
			this._pendingBackup = this._doBackup(serialized).catch((err) => {
				this._warn(`Backup failed: ${errMessage(err)}`);
			});
		}
	}

	// ── Backup ────────────────────────────────────────────────────────────────

	/** Manually trigger a backup right now, regardless of the interval. */
	async backup(): Promise<void> {
		if (!this._loaded) return;
		await this._doBackup(this._serialize(this._value as T));
	}

	private async _doBackup(serialized: string): Promise<void> {
		if (!this._backupDir) return;
		await fsp.mkdir(this._backupDir, { recursive: true });

		const ts = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
		const base = path.basename(this._filePath, '.json');
		const backupPath = path.join(this._backupDir, `${base}-${ts}.json`);

		await this._atomicWrite(backupPath, serialized);

		this._lastBackupAt = Date.now();
		this._s.backupCount++;
		this._s.lastBackupAt = new Date().toISOString();
		this._info(`Backup written → ${path.basename(backupPath)}`);

		await this._pruneBackups();
	}

	private async _pruneBackups(): Promise<void> {
		if (!this._backupDir) return;
		try {
			const base = path.basename(this._filePath, '.json');
			const entries = await fsp.readdir(this._backupDir);
			const mine = entries.filter((e) => e.startsWith(`${base}-`) && e.endsWith('.json')).sort();
			const excess = mine.length - this._backupKeep;
			if (excess > 0) {
				for (let i = 0; i < excess; i++) {
					await fsp.unlink(path.join(this._backupDir, mine[i])).catch(() => {});
				}
				this._info(`Pruned ${excess} old backup(s)`);
			}
		} catch (err) {
			this._warn(`Failed to prune backups: ${errMessage(err)}`);
		}
	}

	private async _pruneQuarantines(): Promise<void> {
		if (!this._quarantineKeep) return;
		try {
			const dir = path.dirname(this._filePath);
			const base = path.basename(this._filePath, '.json');
			const entries = await fsp.readdir(dir);
			const quarantines = entries
				.filter((e) => e.startsWith(`${base}.quarantine-`) && e.endsWith('.json'))
				.sort();
			const excess = quarantines.length - this._quarantineKeep;
			if (excess > 0) {
				for (let i = 0; i < excess; i++) {
					await fsp.unlink(path.join(dir, quarantines[i])).catch(() => {});
				}
			}
		} catch (err) {
			this._warn(`Failed to prune quarantine files: ${errMessage(err)}`);
		}
	}

	// ── Atomic write with retry ───────────────────────────────────────────────

	/**
	 * One atomic write attempt: ensure the directory exists, write content to a
	 * .tmp file (with fsync), then rename over the target. No retry — callers
	 * that want retries wrap this in a loop (see _doFlush).
	 */
	private async _atomicWrite(filePath: string, content: string): Promise<void> {
		await fsp.mkdir(path.dirname(filePath), { recursive: true });
		const tmp = filePath + '.tmp';
		try {
			const fh = await fsp.open(tmp, 'w');
			try {
				await fh.writeFile(content);
				try {
					await fh.sync();
				} catch {
					/* best-effort fsync */
				}
			} finally {
				try {
					await fh.close();
				} catch {
					/* ignore */
				}
			}
			await fsp.rename(tmp, filePath);
		} catch (err) {
			try {
				await fsp.unlink(tmp);
			} catch {
				/* ignore */
			}
			throw err;
		}
	}

	// ── Stats ─────────────────────────────────────────────────────────────────

	getStats(): ManagedFileStats {
		return {
			name: this._name,
			filePath: this._filePath,
			loaded: this._loaded,
			loadedAt: this._s.loadedAt,
			loadSource: this._s.loadSource,
			recoveryUsedOnLoad: this._s.recoveryUsedOnLoad,
			dirty: this._dirty,
			pendingFlushInMs: this._flushTimer !== null ? Math.max(0, this._nextFlushAt - Date.now()) : null,
			lastFlushedAt: this._lastFlushedAt > 0 ? new Date(this._lastFlushedAt).toISOString() : null,
			writeCount: this._s.writeCount,
			auditViolationCount: this._s.auditViolationCount,
			lastBackupAt: this._s.lastBackupAt,
			backupCount: this._s.backupCount,
			prevMetrics: this._prevMetrics
		};
	}

	// ── Shutdown ──────────────────────────────────────────────────────────────

	/**
	 * Flush any pending dirty state and cancel all timers.
	 * Call this during graceful server shutdown before process.exit().
	 */
	async close(): Promise<void> {
		if (this._flushTimer !== null) {
			clearTimeout(this._flushTimer);
			this._flushTimer = null;
		}
		if (this._dirty) {
			this._info('Flushing on close...');
			await this._enqueueFlush();
		}
		// Drain any in-flight checkpoint / backup writes started fire-and-forget
		// from the most recent flush. Errors are already logged; we just wait for
		// them to settle so shutdown doesn't abandon in-progress I/O.
		await Promise.allSettled([this._pendingCheckpoint ?? Promise.resolve(), this._pendingBackup ?? Promise.resolve()]);
		this._info('Closed');
	}
}
