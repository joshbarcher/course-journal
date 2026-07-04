// @ts-nocheck — copied verbatim per its own header comment below ("copy this
// file into the project root"); it predates TypeScript in this codebase and
// was never designed against checkJs, so it's excluded here rather than
// reformatted with JSDoc types that could drift from the canonical copy.
/**
 * @fileoverview Zero-dependency structured logger for Node.js ESM apps.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SETUP
 * ─────────────────────────────────────────────────────────────────────────────
 * Copy this file into the project root, then import it anywhere:
 *
 *   import logger from './logger.js'
 *
 * Requires Node.js 18+. No npm install needed.
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OUTPUT FORMAT
 * ─────────────────────────────────────────────────────────────────────────────
 * Every line follows this fixed-column structure (two spaces between fields):
 *
 *   2026-04-29T19:13:09.144Z  INFO   src/services/data.js:42            Message {"meta":"here"}
 *   ────────────────────────  ─────  ─────────────────────────────────── ──────────────────────
 *   ISO 8601 UTC (24 chars)   level  caller: file path + line (40 chars) message + serialised meta
 *
 *   Level values (always 5 characters, padded):
 *     DEBUG  INFO   WARN   ERROR
 *     (no pad)(space)(space)(no pad)
 *
 *   Caller field:
 *     - Path is relative to process.cwd()
 *     - Always padded or left-truncated to exactly 40 characters
 *     - Truncation keeps the tail (filename:line) which is the useful part:
 *       "…vices/very/long/path/dataService.js:42"
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LEVEL ROUTING
 * ─────────────────────────────────────────────────────────────────────────────
 *   logger.debug()  →  process.stdout   (PM2: {name}-out.log)
 *   logger.info()   →  process.stdout
 *   logger.warn()   →  process.stdout
 *   logger.error()  →  process.stderr   (PM2: {name}-error.log)
 *
 * Keep stderr clean — only route genuine errors there so a non-empty
 * {name}-error.log is always a meaningful signal.
 *
 * Raw stderr writes (uncaught exceptions, missing-module errors, third-party
 * libraries writing directly to process.stderr) are automatically intercepted
 * at module-import time and stamped with an ISO timestamp + STDERR label on
 * the first line of each write() call. Continuation lines (e.g. stack frames)
 * are passed through unchanged so the block stays readable.
 *
 *   Original raw write:
 *     Error: Cannot find module 'missing-dep'\n    at ...
 *
 *   After interception:
 *     2026-04-30T12:00:00.000Z  STDERR  Error: Cannot find module 'missing-dep'
 *         at ...
 *
 * Writes that are already ISO-stamped (i.e. logger.error() output that flows
 * back through stderr) are passed through untouched.
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STARTUP BANNER
 * ─────────────────────────────────────────────────────────────────────────────
 * Call logger.startup() as the very first statement in the server entry point,
 * before any other output. It writes a three-line banner that marks the boundary
 * between the previous process run and the current one in PM2 log files:
 *
 *   2026-04-29T19:13:09.101Z  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   2026-04-29T19:13:09.101Z  START  name=my-app  version=1.2.3  pid=18432  node=v24.0.0
 *   2026-04-29T19:13:09.101Z  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * All three lines share the same timestamp (captured once at call time).
 * The START keyword and ━ bars are unique enough to grep and to render as
 * visual dividers in log viewers.
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * META ARGUMENT
 * ─────────────────────────────────────────────────────────────────────────────
 * All four log methods accept an optional second argument serialised after
 * the message:
 *
 *   undefined / null   →  nothing appended
 *   string             →  appended with a single space:       "msg extra info"
 *   number / boolean   →  converted to string, same as above: "msg 42"
 *   plain object       →  JSON.stringify'd:                   "msg {"port":8003}"
 *   Error              →  newline + two-space indent + stack: "msg\n  Error: boom\n    at ..."
 *
 * Pass structured data as the meta object rather than interpolating into the
 * message string — this keeps messages greppable and consistent.
 *
 *   // Prefer this:
 *   logger.info('User loaded', { id, role })
 *
 *   // Over this:
 *   logger.info(`User ${id} loaded with role ${role}`)
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NAMED STREAMS  (logger.stream)
 * ─────────────────────────────────────────────────────────────────────────────
 * logger.stream('name') returns a StreamLogger that prefixes every message
 * with [name], letting you separate categories of output:
 *
 *   const audit = logger.stream('audit')
 *   audit.info('Login', { user: 'jsmith', ip: '10.0.0.5' })
 *   // → "... INFO   src/audit.js:12                          [audit] Login {"user":"jsmith","ip":"10.0.0.5"}"
 *
 * Streams have the same four methods (debug/info/warn/error) and the same
 * level routing as the main logger.
 *
 * Current behaviour: all streams write to stdout/stderr (same destination as
 * the main logger). Per-file stream support — where each named stream writes
 * to a dedicated log file readable separately via the process manager — is
 * planned for a future iteration.
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROGRESS BARS / TERMINAL UI
 * ─────────────────────────────────────────────────────────────────────────────
 * Do NOT route progress output through the logger. \r-based progress bars
 * write carriage-return characters that pollute PM2 log files.
 *
 * Gate any terminal-only output on process.stdout.isTTY, which is undefined
 * under PM2 (stdout is a pipe, not a TTY) and true in an interactive terminal:
 *
 *   function showProgress(pct) {
 *     if (!process.stdout.isTTY) return      // ← silent under PM2
 *     const bar = '='.repeat(Math.round(pct / 5)).padEnd(20)
 *     process.stdout.write(`\r[${bar}] ${pct}%`)
 *     if (pct >= 100) process.stdout.write('\n')
 *   }
 *
 * Then log the final result through the logger as normal:
 *
 *   await loadAllData(showProgress)
 *   logger.info('Data loaded', { files: count, ms: elapsed })
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WRAPPING
 * ─────────────────────────────────────────────────────────────────────────────
 * Caller detection uses a fixed stack depth. If you wrap logger methods in a
 * helper function, the reported caller will be your wrapper, not the original
 * call site. Avoid wrappers, or increase MAIN_DEPTH / STREAM_DEPTH below to
 * account for the extra frame.
 *
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MIGRATING AN EXISTING APP
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Copy logger.js to the project root.
 *
 * 2. Add logger.js as the FIRST import in src/server.js, before any other
 *    import that could produce output or throw during initialisation:
 *
 *      import logger from './logger.js'        // ← must be first
 *      import express from 'express'           // ← everything else after
 *      ...
 *      logger.startup({ name: 'your-app-name', version: '1.0.0' })
 *
 *    Why first? This is a race condition. ESM modules are evaluated
 *    synchronously in import order. logger.js installs the stderr intercept
 *    as a side effect of being evaluated. If any module is imported before
 *    logger.js and throws or writes to stderr during its own initialisation,
 *    that output fires before the intercept exists and will not be captured.
 *
 * 3. Replace console calls throughout the codebase:
 *      console.log(msg)              →  logger.info(msg)
 *      console.log(msg, data)        →  logger.info(msg, data)
 *      console.warn(msg)             →  logger.warn(msg)
 *      console.warn(msg, data)       →  logger.warn(msg, data)
 *      console.error(msg)            →  logger.error(msg)
 *      console.error(msg, err)       →  logger.error(msg, err)
 *      console.debug(msg)            →  logger.debug(msg)
 *
 *    In files other than the entry point, add the import at the top:
 *      import logger from '../logger.js'   // adjust path depth as needed
 *
 * 4. Find any \r-based progress bars or terminal spinners and add the isTTY
 *    guard at the top of their function:
 *      if (!process.stdout.isTTY) return
 *
 * 5. Remove any remaining bare console.log / console.error calls that were
 *    left in place as debug output — these will appear as unstructured lines
 *    in the log viewer.
 *
 * 6. Raw stderr is automatically captured — no extra code needed. Importing
 *    logger.js installs a synchronous patch on process.stderr.write as a
 *    side effect of module evaluation. Any raw write to stderr after that
 *    point (uncaught exceptions, Node.js internal errors, third-party libs)
 *    gets an ISO timestamp + STDERR label on its first line. This is why
 *    This is why logger.js must win the race — it must be the first import
 *    in the entry point (see step 2).
 */

import { relative, dirname }  from 'node:path'
import { fileURLToPath }       from 'node:url'

// ── Constants ─────────────────────────────────────────────────────────────────

const CALLER_WIDTH = 40
const STARTUP_BAR  = '━'.repeat(54)

const LABELS = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' }

// Matches the ISO 8601 UTC timestamp that opens every structured log line.
// Used to detect writes that are already stamped (e.g. logger.error() output
// flowing back through the stderr intercept) so we don't double-stamp them.
const _ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/

// Stack depth for resolveCaller().
// MAIN_DEPTH=3:   Error → resolveCaller → Logger.method → call site
// STREAM_DEPTH=4: Error → resolveCaller → StreamLogger.#stdout → StreamLogger.method → call site
// STREAM_ERROR_DEPTH=3: Error → resolveCaller → StreamLogger.error → call site
const MAIN_DEPTH         = 3
const STREAM_DEPTH       = 4
const STREAM_ERROR_DEPTH = 3

// logger.js always lives at the project root, so its directory is a reliable
// anchor for resolving caller paths relative to the project.  This matters
// under PM2, which may set process.cwd() to a parent directory rather than
// the project root, causing cwd-relative paths to carry an unwanted prefix.
const LOGGER_DIR = dirname(fileURLToPath(import.meta.url))

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCaller(depth) {
  const lines = new Error().stack.split('\n')
  const raw   = lines[depth] ?? ''
  const m = raw.match(/\((.+):(\d+):\d+\)/) ?? raw.match(/at (.+):(\d+):\d+/)
  if (!m) return 'unknown'
  // ESM stack traces on Linux use file:// URLs rather than plain paths.
  // Convert to a real filesystem path before calling relative().
  let abs = m[1]
  if (abs.startsWith('file://')) { try { abs = fileURLToPath(abs) } catch { /* keep as-is */ } }
  // Compute relative paths from both cwd and the logger's own directory.
  // Pick the shorter one that doesn't escape upward — whichever anchor is
  // closer to the project root wins.  Upward paths (starting with ..) mean
  // the anchor is inside the project, so the file is outside it; discard those.
  const fromCwd    = relative(process.cwd(), abs)
  const fromLogger = relative(LOGGER_DIR, abs)
  const candidates = [fromCwd, fromLogger].filter(p => p.length > 0 && !p.startsWith('..'))
  const best = candidates.sort((a, b) => a.length - b.length)[0]
  return `${best ?? abs}:${m[2]}`
}

function padCaller(str) {
  if (str.length > CALLER_WIDTH) return '…' + str.slice(-(CALLER_WIDTH - 1))
  return str.padEnd(CALLER_WIDTH)
}

function formatMeta(meta) {
  if (meta == null)             return ''
  if (meta instanceof Error)    return '\n  ' + (meta.stack ?? meta.message)
  if (typeof meta === 'object') { try { return ' ' + JSON.stringify(meta) } catch { return ' [object]' } }
  return ' ' + String(meta)
}

function formatLine(label, caller, message, meta) {
  return `${new Date().toISOString()}  ${label}  ${padCaller(caller)}  ${message}${formatMeta(meta)}`
}

// ── Logger ────────────────────────────────────────────────────────────────────

class Logger {
  /**
   * Log a debug-level message to stdout.
   * Use for verbose diagnostic output that is noisy in normal operation.
   * @param {string} msg - The message to log.
   * @param {*} [meta] - Optional value serialised after the message.
   */
  debug(msg, meta) { process.stdout.write(formatLine(LABELS.debug, resolveCaller(MAIN_DEPTH), msg, meta) + '\n') }

  /**
   * Log an info-level message to stdout.
   * Use for normal operational events (server started, request handled, file loaded).
   * @param {string} msg - The message to log.
   * @param {*} [meta] - Optional value serialised after the message.
   */
  info(msg, meta) { process.stdout.write(formatLine(LABELS.info, resolveCaller(MAIN_DEPTH), msg, meta) + '\n') }

  /**
   * Log a warning-level message to stdout.
   * Use for recoverable problems or unexpected-but-handled conditions.
   * @param {string} msg - The message to log.
   * @param {*} [meta] - Optional value serialised after the message.
   */
  warn(msg, meta) { process.stdout.write(formatLine(LABELS.warn, resolveCaller(MAIN_DEPTH), msg, meta) + '\n') }

  /**
   * Log an error-level message to stderr.
   * Use for unhandled exceptions, failed operations, and anything that needs
   * immediate attention. Errors go to stderr so PM2's {name}-error.log stays
   * clean and a non-empty file is always a meaningful signal.
   * @param {string} msg - The message to log.
   * @param {Error|*} [meta] - Optional Error (stack included) or any other value.
   */
  error(msg, meta) { process.stderr.write(formatLine(LABELS.error, resolveCaller(MAIN_DEPTH), msg, meta) + '\n') }

  /**
   * Write a three-line startup banner to stdout.
   *
   * Call this as the very first statement in the server entry point, before
   * any other output. The banner's timestamp marks the boundary between the
   * previous process run and the current one in PM2 log files.
   *
   * All three lines share the same timestamp (captured once at call time),
   * so log viewers can use the START keyword or ━ bars to split runs.
   *
   * @param {object} [opts]
   * @param {string} [opts.name='app']  - The process name shown in the banner.
   * @param {string} [opts.version]     - Optional semver string (omitted if not provided).
   *
   * @example
   * logger.startup({ name: 'private-url', version: '1.4.2' })
   * // stdout:
   * // 2026-04-29T19:13:09.101Z  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * // 2026-04-29T19:13:09.101Z  START  name=private-url  version=1.4.2  pid=18432  node=v24.0.0
   * // 2026-04-29T19:13:09.101Z  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  startup({ name = 'app', version = null } = {}) {
    const ts    = new Date().toISOString()
    const parts = [`name=${name}`]
    if (version) parts.push(`version=${version}`)
    parts.push(`pid=${process.pid}`, `node=${process.version}`)
    process.stdout.write(`${ts}  ${STARTUP_BAR}\n`)
    process.stdout.write(`${ts}  START  ${parts.join('  ')}\n`)
    process.stdout.write(`${ts}  ${STARTUP_BAR}\n`)
  }

  /**
   * Return a StreamLogger that prefixes every message with [name].
   *
   * Use streams to separate logical categories of output without changing
   * the destination. Streams have the same four methods (debug/info/warn/error)
   * and the same level routing (debug/info/warn → stdout, error → stderr).
   *
   * Currently all streams write to the same stdout/stderr as the main logger.
   * Per-file stream support (where each named stream writes to a dedicated file
   * viewable separately via the process manager) is planned for a future iteration.
   *
   * @param {string} name - Stream name used as the message prefix, e.g. 'audit'.
   * @returns {StreamLogger}
   *
   * @example
   * const audit = logger.stream('audit')
   * audit.info('Login', { user: 'jsmith', ip: '10.0.0.5' })
   * // → "... INFO   src/audit.js:12                          [audit] Login {"user":"jsmith",...}"
   */
  stream(name) { return new StreamLogger(name) }
}

// ── StreamLogger ──────────────────────────────────────────────────────────────

class StreamLogger {
  #name
  constructor(name) { this.#name = name }

  #stdout(label, msg, meta) {
    process.stdout.write(formatLine(label, resolveCaller(STREAM_DEPTH), `[${this.#name}] ${msg}`, meta) + '\n')
  }

  /** @param {string} msg @param {*} [meta] */
  debug(msg, meta) { this.#stdout(LABELS.debug, msg, meta) }
  /** @param {string} msg @param {*} [meta] */
  info (msg, meta) { this.#stdout(LABELS.info,  msg, meta) }
  /** @param {string} msg @param {*} [meta] */
  warn (msg, meta) { this.#stdout(LABELS.warn,  msg, meta) }
  /** @param {string} msg @param {Error|*} [meta] */
  error(msg, meta) {
    process.stderr.write(formatLine(LABELS.error, resolveCaller(STREAM_ERROR_DEPTH), `[${this.#name}] ${msg}`, meta) + '\n')
  }
}

// ── Stderr intercept ──────────────────────────────────────────────────────────

/**
 * Stamp a raw stderr chunk with an ISO timestamp + STDERR label.
 *
 * Rules:
 *  - Empty / whitespace-only strings → returned unchanged (no phantom timestamps).
 *  - Strings already starting with an ISO timestamp → returned unchanged
 *    (logger.error() output flows through stderr; don't double-stamp it).
 *  - Everything else → first line gets "{ts}  STDERR  " prefix; subsequent
 *    lines (stack frames, continuation text) are left as-is.
 *
 * This is a pure function exported for unit testing.
 *
 * @param {string} str - The decoded string from a process.stderr.write() call.
 * @returns {string}
 */
export function _formatStderrChunk(str) {
  if (!str.trim()) return str
  if (_ISO_RE.test(str)) return str
  const ts = new Date().toISOString()
  return str.replace(/^([^\n]*)/, `${ts}  STDERR  $1`)
}

// Intercept process.stderr.write at module-load time.  Raw writes (Node.js
// internal errors, uncaught exceptions, third-party libraries) get an ISO
// timestamp on the first line so they can be interleaved chronologically with
// the structured stdout log when reading PM2 log files.
const _stderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = function stderrCapture(chunk, encoding, callback) {
  if (typeof encoding === 'function') { callback = encoding; encoding = undefined }
  const str = Buffer.isBuffer(chunk) ? chunk.toString(encoding ?? 'utf8') : String(chunk)
  return _stderrWrite(_formatStderrChunk(str), undefined, callback)
}

// ── Export ────────────────────────────────────────────────────────────────────

export default new Logger()
