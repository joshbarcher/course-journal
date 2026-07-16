// Ported from src/services/journalService.js — one JournalService instance
// manages a single course's pages.json-equivalent file via ManagedFile.
import { randomUUID } from 'node:crypto';
import logger from '../../../../logger.js';
import { ManagedFile, type LogLevel } from './managed-file';
import {
	PagesFileSchema,
	typeDefaults,
	VALID_PAGE_TYPES,
	type Page,
	type PagesFile,
	type PageType
} from '$lib/schemas/page';

export { VALID_PAGE_TYPES, typeDefaults };

function now(): string {
	return new Date().toISOString();
}

function managedFileLog(level: LogLevel, msg: string, meta?: unknown) {
	(logger as unknown as Record<string, (msg: string, meta?: unknown) => void>)[level]?.(msg, meta);
}

export class JournalService {
	private _mf: ManagedFile<PagesFile>;

	constructor(filePath: string) {
		this._mf = new ManagedFile<PagesFile>({
			filePath,
			name: 'pages',
			defaultValue: () => ({ pages: [] }),
			// Reuses ManagedFile's existing corrupt-file → checkpoint → default
			// recovery path for free: a page that doesn't match the schema is
			// treated exactly like a JSON syntax error.
			parse: (str) => PagesFileSchema.parse(JSON.parse(str)),
			maxFlushIntervalMs: 30_000,
			log: managedFileLog
		});
	}

	async load(): Promise<void> {
		await this._mf.load();
	}

	async flush(): Promise<void> {
		await this._mf.flush();
	}

	async close(): Promise<void> {
		await this._mf.close();
	}

	getAll(): Page[] {
		return [...this._mf.get().pages];
	}

	getById(id: string): Page | null {
		const page = this._mf.get().pages.find((p) => p.id === id);
		return page ? { ...page } : null;
	}

	async create(data: { type: PageType; title: string } & Record<string, unknown>): Promise<Page> {
		const { type, title, ...rest } = data;
		const page = {
			type,
			title,
			...typeDefaults(type),
			...rest,
			// id/createdAt/updatedAt are stamped AFTER ...rest so a client can
			// never override them via an extra body field: a caller-chosen id
			// would let two pages share one id (breaking getById/update/delete
			// and losing a page on the next reorder).
			id: randomUUID(),
			createdAt: now(),
			updatedAt: now()
		} as Page;
		const current = this._mf.get();
		await this._mf.set({ pages: [...current.pages, page] });
		return page;
	}

	async update(id: string, updates: Record<string, unknown>): Promise<Page | null> {
		const current = this._mf.get();
		const idx = current.pages.findIndex((p) => p.id === id);
		if (idx === -1) return null;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _id, type: _type, createdAt: _created, ...safe } = updates;
		const updated = { ...current.pages[idx], ...safe, updatedAt: now() } as Page;
		const pages = [...current.pages];
		pages[idx] = updated;
		await this._mf.set({ pages });
		return updated;
	}

	async remove(id: string): Promise<boolean> {
		const current = this._mf.get();
		const exists = current.pages.some((p) => p.id === id);
		if (!exists) return false;
		await this._mf.set({ pages: current.pages.filter((p) => p.id !== id) });
		return true;
	}

	async reorder(ids: string[]): Promise<void> {
		const current = this._mf.get();
		const map = new Map(current.pages.map((p) => [p.id, p]));
		// Dedupe incoming ids before mapping: a repeated id would otherwise
		// resolve to the same page twice and duplicate it in the stored array
		// (the persisted `pages` list has no id-uniqueness constraint).
		const seen = new Set<string>();
		const reordered = ids
			.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
			.map((id) => map.get(id))
			.filter((p): p is Page => Boolean(p));
		const rest = current.pages.filter((p) => !seen.has(p.id));
		await this._mf.set({ pages: [...reordered, ...rest] });
	}
}
