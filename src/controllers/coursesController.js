import logger from '../../logger.js'
import { getCourseService } from '../services/courseService.js'

export function listCourses(req, res) {
    res.json(getCourseService().getAll())
}

export function getCourse(req, res) {
    const course = getCourseService().getById(req.params.id)
    if (!course) return res.status(404).json({ error: 'Course not found' })
    res.json(course)
}

export async function createCourse(req, res) {
    const { title } = req.body ?? {}
    if (!title) return res.status(400).json({ error: 'title is required' })
    try {
        const course = await getCourseService().create({ title })
        res.status(201).json(course)
    } catch (err) {
        logger.error('Failed to create course', err)
        res.status(500).json({ error: 'Failed to create course' })
    }
}

export async function updateCourse(req, res) {
    const { title } = req.body ?? {}
    if (!title) return res.status(400).json({ error: 'title is required' })
    try {
        const course = await getCourseService().update(req.params.id, { title })
        if (!course) return res.status(404).json({ error: 'Course not found' })
        res.json(course)
    } catch (err) {
        logger.error('Failed to update course', err)
        res.status(500).json({ error: 'Failed to update course' })
    }
}

export async function deleteCourse(req, res) {
    try {
        const removed = await getCourseService().remove(req.params.id)
        if (!removed) return res.status(404).json({ error: 'Course not found' })
        res.status(204).end()
    } catch (err) {
        logger.error('Failed to delete course', err)
        res.status(500).json({ error: 'Failed to delete course' })
    }
}

export async function copyCourse(req, res) {
    try {
        const course = await getCourseService().copy(req.params.id)
        if (!course) return res.status(404).json({ error: 'Course not found' })
        res.status(201).json(course)
    } catch (err) {
        logger.error('Failed to copy course', err)
        res.status(500).json({ error: 'Failed to copy course' })
    }
}
