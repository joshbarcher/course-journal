import logger from '../logger.js'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import healthRouter from './routes/health.js'
import apiRouter from './routes/api.js'
import { getCourseService } from './services/courseService.js'

logger.startup({ name: 'course-journal', version: '1.0.0' })

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()

app.use(express.static(join(__dirname, '..', 'public')))
app.use(express.json())
app.use('/health', healthRouter)
app.use('/api', apiRouter)

const PORT = process.env.PORT ?? 8060

await getCourseService().load()
logger.info('Course data loaded')

const server = app.listen(PORT, () => {
    logger.info('Server listening', { port: PORT })
})

let _shuttingDown = false

async function shutdown(reason, exitCode = 0) {
    if (_shuttingDown) return
    _shuttingDown = true
    logger.info(`Shutting down (${reason})`)

    await new Promise(resolve => {
        server.closeAllConnections?.()
        server.close(resolve)
    })

    try {
        await getCourseService().close()
    } catch (err) {
        logger.error('Flush failed during shutdown', { err })
    }
    process.exit(exitCode)
}

process.on('SIGTERM',             () => shutdown('SIGTERM'))
process.on('SIGINT',              () => shutdown('SIGINT'))
process.on('SIGHUP',              () => shutdown('SIGHUP'))
process.on('beforeExit',          () => shutdown('beforeExit'))
process.on('uncaughtException',   (err) => { logger.error('Uncaught exception', { err }); shutdown('uncaughtException', 1) })
process.on('unhandledRejection',  (reason) => { logger.error('Unhandled rejection', { reason }); shutdown('unhandledRejection', 1) })

export default app
