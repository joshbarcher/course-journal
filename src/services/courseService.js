import { randomUUID } from 'node:crypto'
import path from 'node:path'
import logger from '../../logger.js'
import { ManagedFile } from '../shared/managed-file.js'
import { JournalService } from './journalService.js'

function now() {
    return new Date().toISOString()
}

function log(level, msg, meta) {
    logger[level]?.(msg, meta)
}

function resetPageState(page) {
    if (page.type === 'progress') {
        return { ...page, tasks: (page.tasks ?? []).map(t => ({ ...t, state: null })), notes: '' }
    }
    if (page.type === 'progress-bars') {
        return {
            ...page,
            bars: (page.bars ?? []).map(b => ({
                ...b,
                steps: (b.steps ?? []).map(s => ({ ...s, state: null })),
            })),
            notes: '',
        }
    }
    if (page.type === 'notes') {
        return { ...page, notes: [] }
    }
    if (page.type === 'list') {
        return { ...page, items: (page.items ?? []).map(i => ({ ...i, done: false })) }
    }
    return page
}

export class CourseService {
    constructor(baseDir) {
        this._baseDir = baseDir
        this._coursesDir = path.join(baseDir, 'courses')
        this._mf = new ManagedFile({
            filePath: path.join(baseDir, 'courses.json'),
            name: 'courses',
            defaultValue: () => ({ courses: [] }),
            maxFlushIntervalMs: 30_000,
            log,
        })
        this._journals = new Map()
    }

    async load() {
        await this._mf.load()
        for (const course of this._mf.get().courses) {
            await this._ensureJournal(course.id)
        }
    }

    async flush() {
        await this._mf.flush()
        for (const js of this._journals.values()) {
            await js.flush()
        }
    }

    async close() {
        await this._mf.close()
        for (const js of this._journals.values()) {
            await js.close()
        }
    }

    async _ensureJournal(courseId) {
        if (!this._journals.has(courseId)) {
            const filePath = path.join(this._coursesDir, `${courseId}.json`)
            const js = new JournalService(filePath)
            await js.load()
            this._journals.set(courseId, js)
        }
        return this._journals.get(courseId)
    }

    getJournal(courseId) {
        const js = this._journals.get(courseId)
        if (!js) throw new Error(`No journal for course ${courseId}`)
        return js
    }

    getAll() {
        return [...this._mf.get().courses]
    }

    getById(id) {
        const c = this._mf.get().courses.find(c => c.id === id)
        return c ? { ...c } : null
    }

    async create(data) {
        const course = {
            id: randomUUID(),
            title: data.title,
            createdAt: now(),
            updatedAt: now(),
        }
        const current = this._mf.get()
        await this._mf.set({ courses: [...current.courses, course] })
        await this._ensureJournal(course.id)
        return course
    }

    async update(id, updates) {
        const current = this._mf.get()
        const idx = current.courses.findIndex(c => c.id === id)
        if (idx === -1) return null
        const { id: _id, createdAt: _c, ...safe } = updates
        const updated = { ...current.courses[idx], ...safe, updatedAt: now() }
        const courses = [...current.courses]
        courses[idx] = updated
        await this._mf.set({ courses })
        return updated
    }

    async remove(id) {
        const current = this._mf.get()
        const exists = current.courses.some(c => c.id === id)
        if (!exists) return false
        await this._mf.set({ courses: current.courses.filter(c => c.id !== id) })
        const js = this._journals.get(id)
        if (js) {
            await js.close()
            this._journals.delete(id)
        }
        return true
    }

    async copy(id) {
        const source = this.getById(id)
        if (!source) return null
        const sourceJournal = this.getJournal(id)
        const sourcePages = sourceJournal.getAll()
        const newCourse = await this.create({ title: `${source.title} (Copy)` })
        const newJournal = this.getJournal(newCourse.id)
        for (const page of sourcePages) {
            const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = page
            await newJournal.create(resetPageState(rest))
        }
        return newCourse
    }
}

let _service = null

export function getCourseService() {
    if (!_service) {
        const dataDir = process.env.DATA_DIR
        if (!dataDir) throw new Error('DATA_DIR is not set')
        _service = new CourseService(path.join(dataDir, 'course-journal'))
    }
    return _service
}
