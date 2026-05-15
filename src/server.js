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

app.listen(PORT, () => {
    logger.info('Server listening', { port: PORT })
})

async function shutdown(signal) {
    logger.info(`${signal} received — shutting down`)
    await getCourseService().close()
    process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

export default app
