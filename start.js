// Production entry point for PM2 (see apps.json's "script" field).
//
// Kills anything already bound to PORT (defensive — PM2 should prevent
// this under normal operation, but a stuck process from an earlier abrupt
// stop can leave the port occupied) using `fuser`, the standard tool on
// the Linux production host this targets. If `fuser` isn't available
// (e.g. running this locally on Windows) the kill attempt is silently
// skipped rather than failing the whole start — the server spawn below
// is plain cross-platform Node either way.
//
// Unlike a terminal Ctrl+C (which broadcasts SIGINT to the whole process
// group), PM2 sends signals directly to this process's PID only, so they
// must be explicitly relayed to the spawned server child — without that,
// the server's own graceful shutdown (hooks.server.ts, which flushes
// pending ManagedFile writes) would never get a chance to run.
import { execSync, spawn } from 'node:child_process'

const port = process.env.PORT

if (!port) {
    console.error('PORT must be set in .env')
    process.exit(1)
}

try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
    console.log(`Killed process(es) on port ${port}`)
} catch {
    // Port was free, fuser isn't installed, or nothing to kill — proceed
}

const server = spawn('node', ['--env-file', '.env', 'build/index.js'], { stdio: 'inherit' })
server.on('exit', code => process.exit(code ?? 0))

process.on('SIGINT',  () => server.kill('SIGINT'))
process.on('SIGTERM', () => server.kill('SIGTERM'))
