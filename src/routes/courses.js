import { Router } from 'express'
import { getCourseService } from '../services/courseService.js'
import {
    listCourses, getCourse, createCourse, updateCourse, deleteCourse, copyCourse,
} from '../controllers/coursesController.js'
import {
    listPages, getPage, createPage, updatePage, deletePage, reorderPages,
} from '../controllers/pagesController.js'

const router = Router()

router.get('/',          listCourses)
router.post('/',         createCourse)
router.get('/:id',       getCourse)
router.put('/:id',       updateCourse)
router.delete('/:id',    deleteCourse)
router.post('/:id/copy', copyCourse)

// Nested pages — resolve journal from courseId param
const pagesRouter = Router({ mergeParams: true })

pagesRouter.use((req, res, next) => {
    try {
        req.journal = getCourseService().getJournal(req.params.courseId)
        next()
    } catch {
        res.status(404).json({ error: 'Course not found' })
    }
})

pagesRouter.get('/',        listPages)
pagesRouter.put('/order',   reorderPages)
pagesRouter.get('/:id',     getPage)
pagesRouter.post('/',       createPage)
pagesRouter.put('/:id',     updatePage)
pagesRouter.delete('/:id',  deletePage)

router.use('/:courseId/pages', pagesRouter)

export default router
