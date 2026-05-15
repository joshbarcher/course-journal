import { Router } from 'express'
import coursesRouter from './courses.js'

const router = Router()

router.use('/courses', coursesRouter)

export default router
