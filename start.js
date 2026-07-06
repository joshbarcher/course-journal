// Shared entry point for both the production process (PM2, see apps.json's
// "script" field) and `npm run dev` (see package.json's "dev" script,
// which passes --dev) — both need the same "make sure nothing is already
// bound to PORT, then relay shutdown signals to the child" behavior, just
// spawning a different underlying command.
//
// Kills anything already bound to PORT (defensive — PM2 should prevent
// this under normal operation, but a stuck process from an earlier abrupt
// stop, or a leftover `npm run dev`, can leave the port occupied). Uses
// `fuser` on the Linux production host this targets; on Windows (this dev
// machine), falls back to netstat + taskkill since fuser doesn't exist
// there.
//
// Unlike a terminal Ctrl+C (which broadcasts SIGINT to the whole process
// group), PM2 sends signals directly to this process's PID only, so they
// must be explicitly relayed to the spawned server child — without that,
// the server's own graceful shutdown (hooks.server.ts, which flushes
// pending ManagedFile writes) would never get a chance to run.
import { execSync, spawn } from 'node:child_process'

const port = process.env.PORT
const isDev = process.argv.includes('--dev')

if (!port) {
    console.error('PORT must be set in .env')
    process.exit(1)
}

function killPort(port) {
    if (process.platform === 'win32') {
        try {
            const out = execSync(`netstat -ano | findstr :${port}`).toString()
            const pids = new Set(
                out
                    .split('\n')
                    .map((line) => line.trim().split(/\s+/).pop())
                    .filter((pid) => pid && /^\d+$/.test(pid))
            )
            for (const pid of pids) {
                try {
                    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
                    console.log(`Killed process ${pid} on port ${port}`)
                } catch {
                    // Already gone, or not ours to kill — ignore.
                }
            }
        } catch {
            // findstr found nothing — port was already free.
        }
    } else {
        try {
            execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
            console.log(`Killed process(es) on port ${port}`)
        } catch {
            // Port was free, fuser isn't installed, or nothing to kill.
        }
    }
}

killPort(port)

const command = isDev ? 'npx vite dev' : 'node --env-file .env build/index.js'
const server = spawn(command, { stdio: 'inherit', shell: true })
server.on('exit', code => process.exit(code ?? 0))

process.on('SIGINT',  () => server.kill('SIGINT'))
process.on('SIGTERM', () => server.kill('SIGTERM'))
