import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    segmentColor,
    barProgressPercent,
    percentToColor,
    globalSegments,
    heatmapRows,
    STATE_COLORS,
} from '../../public/js/views/progress-helpers.js'

const DIM = 'rgba(255,255,255,0.10)'

describe('segmentColor', () => {
    it('returns teal for done', () => {
        assert.equal(segmentColor('done'), STATE_COLORS.done)
    })
    it('returns gold for working', () => {
        assert.equal(segmentColor('working'), STATE_COLORS.working)
    })
    it('returns blue for started', () => {
        assert.equal(segmentColor('started'), STATE_COLORS.started)
    })
    it('returns dim for null', () => {
        assert.equal(segmentColor(null), DIM)
    })
    it('returns dim for undefined', () => {
        assert.equal(segmentColor(undefined), DIM)
    })
    it('returns dim for unknown state', () => {
        assert.equal(segmentColor('nope'), DIM)
    })
})

describe('barProgressPercent', () => {
    it('returns 0 for empty steps', () => {
        assert.equal(barProgressPercent({ steps: [] }), 0)
    })
    it('returns 0 when steps is missing', () => {
        assert.equal(barProgressPercent({}), 0)
    })
    it('returns 100 when all done', () => {
        const bar = { steps: [{ state: 'done' }, { state: 'done' }] }
        assert.equal(barProgressPercent(bar), 100)
    })
    it('returns 50 when half done', () => {
        const bar = { steps: [{ state: 'done' }, { state: 'working' }] }
        assert.equal(barProgressPercent(bar), 50)
    })
    it('returns 0 when none done', () => {
        const bar = { steps: [{ state: 'working' }, { state: 'started' }] }
        assert.equal(barProgressPercent(bar), 0)
    })
    it('rounds to nearest integer', () => {
        const bar = { steps: [{ state: 'done' }, { state: null }, { state: null }] }
        assert.equal(barProgressPercent(bar), 33)
    })
})

describe('percentToColor', () => {
    it('returns done color at 100', () => {
        assert.equal(percentToColor(100), STATE_COLORS.done)
    })
    it('returns working color at 50', () => {
        assert.equal(percentToColor(50), STATE_COLORS.working)
    })
    it('returns working color at 99', () => {
        assert.equal(percentToColor(99), STATE_COLORS.working)
    })
    it('returns started color at 1', () => {
        assert.equal(percentToColor(1), STATE_COLORS.started)
    })
    it('returns dim at 0', () => {
        assert.equal(percentToColor(0), DIM)
    })
})

describe('globalSegments', () => {
    it('returns empty for unknown type', () => {
        assert.deepEqual(globalSegments({ type: 'list' }), [])
    })

    it('returns one segment per task for progress type', () => {
        const page = {
            type: 'progress',
            tasks: [
                { id: '1', title: 'Task A', state: 'done' },
                { id: '2', title: 'Task B', state: null },
            ],
        }
        const segs = globalSegments(page)
        assert.equal(segs.length, 2)
        assert.equal(segs[0].num, 1)
        assert.equal(segs[0].color, STATE_COLORS.done)
        assert.equal(segs[0].label, 'Task A')
        assert.equal(segs[1].color, DIM)
    })

    it('returns one segment per bar for progress-bars type', () => {
        const page = {
            type: 'progress-bars',
            bars: [
                { id: '1', title: 'Bar A', steps: [{ state: 'done' }, { state: 'done' }] },
                { id: '2', title: 'Bar B', steps: [] },
            ],
        }
        const segs = globalSegments(page)
        assert.equal(segs.length, 2)
        assert.equal(segs[0].color, STATE_COLORS.done)
        assert.equal(segs[1].color, DIM)
        assert.equal(segs[1].num, 2)
    })

    it('returns empty array when tasks/bars missing', () => {
        assert.deepEqual(globalSegments({ type: 'progress' }), [])
        assert.deepEqual(globalSegments({ type: 'progress-bars' }), [])
    })
})

describe('heatmapRows', () => {
    it('returns empty array when no progress pages', () => {
        assert.deepEqual(heatmapRows([{ type: 'list', id: '1', title: 'T' }]), [])
    })

    it('filters to progress and progress-bars only', () => {
        const pages = [
            { type: 'list',          id: '1', title: 'L', items: [] },
            { type: 'notes',         id: '2', title: 'N', notes: [] },
            { type: 'progress',      id: '3', title: 'P', tasks: [] },
            { type: 'progress-bars', id: '4', title: 'PB', bars: [] },
            { type: 'page',          id: '5', title: 'Pg', content: '' },
        ]
        const rows = heatmapRows(pages)
        assert.equal(rows.length, 2)
        assert.equal(rows[0].id, '3')
        assert.equal(rows[1].id, '4')
    })

    it('maps each page to { id, title, cells }', () => {
        const page = {
            type: 'progress',
            id: 'abc',
            title: 'My Page',
            tasks: [{ id: 't1', title: 'Task', state: 'done' }],
        }
        const rows = heatmapRows([page])
        assert.equal(rows[0].id, 'abc')
        assert.equal(rows[0].title, 'My Page')
        assert.equal(rows[0].cells.length, 1)
        assert.equal(rows[0].cells[0].color, STATE_COLORS.done)
    })

    it('preserves page order', () => {
        const pages = [
            { type: 'progress', id: 'a', title: 'First',  tasks: [] },
            { type: 'progress', id: 'b', title: 'Second', tasks: [] },
        ]
        const rows = heatmapRows(pages)
        assert.equal(rows[0].id, 'a')
        assert.equal(rows[1].id, 'b')
    })
})
