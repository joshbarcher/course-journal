import logger from '../logger.js'
import express from 'express'
import healthRouter from './routes/health.js'

logger.startup({ name: 'course-journal', version: '1.0.0' })

const app = express()

app.use(express.json())

app.use('/health', healthRouter)

const PORT = process.env.PORT ?? 8060

app.listen(PORT, () => {
    logger.info('Server listening', { port: PORT })
})

export default app
