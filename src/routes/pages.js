import { Router } from 'express'
import {
    listPages,
    getPage,
    createPage,
    updatePage,
    deletePage,
} from '../controllers/pagesController.js'

const router = Router()

router.get('/',      listPages)
router.get('/:id',   getPage)
router.post('/',     createPage)
router.put('/:id',   updatePage)
router.delete('/:id', deletePage)

export default router
