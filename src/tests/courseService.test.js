import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { CourseService } from '../services/courseService.js'

function tmpDir() {
    return path.join(os.tmpdir(), `course-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

async function cleanupDir(dir) {
    await fsp.rm(dir, { recursive: true, force: true })
}

describe('CourseService', () => {
    let service
    let baseDir

    beforeEach(async () => {
        baseDir = tmpDir()
        service = new CourseService(baseDir)
        await service.load()
    })

    afterEach(async () => {
        await service.close()
        await cleanupDir(baseDir)
    })

    describe('initial state', () => {
        it('starts with no courses', () => {
            assert.deepEqual(service.getAll(), [])
        })
    })

    describe('create', () => {
        it('returns a course with generated id', async () => {
            const course = await service.create({ title: 'Math 101' })
            assert.ok(course.id)
            assert.equal(typeof course.id, 'string')
        })

        it('sets title and timestamps', async () => {
            const course = await service.create({ title: 'Physics' })
            assert.equal(course.title, 'Physics')
            assert.ok(new Date(course.createdAt).getTime())
            assert.ok(new Date(course.updatedAt).getTime())
        })

        it('adds course to getAll()', async () => {
            await service.create({ title: 'A' })
            await service.create({ title: 'B' })
            assert.equal(service.getAll().length, 2)
        })

        it('creates a journal for the new course', async () => {
            const course = await service.create({ title: 'Chemistry' })
            const journal = service.getJournal(course.id)
            assert.ok(journal)
            assert.deepEqual(journal.getAll(), [])
        })
    })

    describe('getById', () => {
        it('returns course by id', async () => {
            const created = await service.create({ title: 'History' })
            const found = service.getById(created.id)
            assert.equal(found.title, 'History')
        })

        it('returns null for unknown id', () => {
            assert.equal(service.getById('nope'), null)
        })
    })

    describe('update', () => {
        it('renames a course', async () => {
            const course = await service.create({ title: 'Old' })
            const updated = await service.update(course.id, { title: 'New' })
            assert.equal(updated.title, 'New')
        })

        it('preserves id and createdAt', async () => {
            const course = await service.create({ title: 'X' })
            const updated = await service.update(course.id, { id: 'hacked', title: 'Y', createdAt: '1970' })
            assert.equal(updated.id, course.id)
            assert.equal(updated.createdAt, course.createdAt)
        })

        it('returns null for unknown id', async () => {
            const result = await service.update('nope', { title: 'Y' })
            assert.equal(result, null)
        })
    })

    describe('remove', () => {
        it('removes a course and returns true', async () => {
            const course = await service.create({ title: 'Delete me' })
            const result = await service.remove(course.id)
            assert.equal(result, true)
            assert.equal(service.getById(course.id), null)
        })

        it('returns false for unknown id', async () => {
            assert.equal(await service.remove('nope'), false)
        })

        it('cleans up the journal from memory', async () => {
            const course = await service.create({ title: 'Temp' })
            await service.remove(course.id)
            assert.throws(() => service.getJournal(course.id), /No journal/)
        })
    })

    describe('copy', () => {
        it('returns null for unknown source', async () => {
            const result = await service.copy('nope')
            assert.equal(result, null)
        })

        it('creates a new course with "(Copy)" suffix', async () => {
            const source = await service.create({ title: 'Algebra' })
            const copy = await service.copy(source.id)
            assert.equal(copy.title, 'Algebra (Copy)')
            assert.notEqual(copy.id, source.id)
        })

        it('copies pages from source into new course', async () => {
            const source = await service.create({ title: 'Bio' })
            const journal = service.getJournal(source.id)
            await journal.create({ type: 'notes', title: 'Week 1' })
            await journal.create({ type: 'list', title: 'Topics' })

            const copy = await service.copy(source.id)
            const copyJournal = service.getJournal(copy.id)
            const copyPages = copyJournal.getAll()
            assert.equal(copyPages.length, 2)
            assert.equal(copyPages[0].title, 'Week 1')
            assert.equal(copyPages[1].title, 'Topics')
        })

        it('assigns new IDs to copied pages', async () => {
            const source = await service.create({ title: 'CS' })
            const journal = service.getJournal(source.id)
            const origPage = await journal.create({ type: 'notes', title: 'Notes' })

            const copy = await service.copy(source.id)
            const copyPages = service.getJournal(copy.id).getAll()
            assert.notEqual(copyPages[0].id, origPage.id)
        })

        it('resets progress task states to null', async () => {
            const source = await service.create({ title: 'Stats' })
            const journal = service.getJournal(source.id)
            await journal.create({
                type: 'progress',
                title: 'Slides',
                tasks: [{ id: 't1', title: 'Slide 1', state: 'done' }],
            })

            const copy = await service.copy(source.id)
            const copyPages = service.getJournal(copy.id).getAll()
            assert.equal(copyPages[0].tasks[0].state, null)
        })

        it('resets progress-bars step states to null', async () => {
            const source = await service.create({ title: 'Calc' })
            const journal = service.getJournal(source.id)
            await journal.create({
                type: 'progress-bars',
                title: 'Modules',
                bars: [{ id: 'b1', title: 'Mod 1', steps: [{ id: 's1', title: 'Step', state: 'working' }] }],
            })

            const copy = await service.copy(source.id)
            const copyPages = service.getJournal(copy.id).getAll()
            assert.equal(copyPages[0].bars[0].steps[0].state, null)
        })

        it('resets notes to empty array', async () => {
            const source = await service.create({ title: 'Eng' })
            const journal = service.getJournal(source.id)
            await journal.create({
                type: 'notes',
                title: 'My Notes',
                notes: [{ id: 'n1', text: 'Hello', createdAt: '' }],
            })

            const copy = await service.copy(source.id)
            const copyPages = service.getJournal(copy.id).getAll()
            assert.deepEqual(copyPages[0].notes, [])
        })

        it('preserves page content in rich text pages', async () => {
            const source = await service.create({ title: 'Lit' })
            const journal = service.getJournal(source.id)
            await journal.create({ type: 'page', title: 'Lecture 1', content: '<p>Hello</p>' })

            const copy = await service.copy(source.id)
            const copyPages = service.getJournal(copy.id).getAll()
            assert.equal(copyPages[0].content, '<p>Hello</p>')
        })
    })
})
