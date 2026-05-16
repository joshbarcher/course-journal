import logger from '../logger.js'
import { execSync, spawn } from 'node:child_process'

const port = process.env.PORT

if (!port) {
    logger.error('PORT must be set in .env')
    process.exit(1)
}

try {
    const pid = execSync(
        `powershell -command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess"`,
        { encoding: 'utf8' }
    ).trim()

    if (pid && pid !== '0') {
        logger.info(`Port ${port} in use by PID ${pid} — killing…`)
        execSync(`powershell -command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`)
    }
} catch {
    // port is free or check failed — proceed
}

const server = spawn('node', ['--env-file', '.env', 'src/server.js'], { stdio: 'inherit' })
server.on('exit', code => process.exit(code ?? 0))

// Ctrl+C sends SIGINT to the whole process group — both boot.js and server.js
// receive it simultaneously. Let server.js run its graceful shutdown and exit;
// boot.js will then exit via the 'exit' listener above. Without this handler
// Node.js would terminate boot.js immediately, disrupting the child's async
// shutdown before it can flush pending data.
process.on('SIGINT',  () => {})
process.on('SIGTERM', () => server.kill('SIGTERM'))
