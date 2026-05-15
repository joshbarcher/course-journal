export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function progressPercent(page) {
    if (page.type === 'progress') {
        if (!page.tasks?.length) return 0
        const done = page.tasks.filter(t => t.state === 'done').length
        return Math.round((done / page.tasks.length) * 100)
    }
    if (page.type === 'progress-bars') {
        const allSteps = (page.bars ?? []).flatMap(b => b.steps ?? [])
        if (!allSteps.length) return 0
        const done = allSteps.filter(s => s.state === 'done').length
        return Math.round((done / allSteps.length) * 100)
    }
    return 0
}

// Canonical display order for page types across the app
export const TYPE_ORDER = ['list', 'progress', 'progress-bars', 'notes', 'page']

export const TYPE_LABELS = {
    list:             'Lists',
    progress:         'Progress',
    'progress-bars':  'Progress (Multi)',
    notes:            'Notes',
    page:             'Pages',
}

// Groups pages by type, preserving TYPE_ORDER. Returns an array of
// { type, label, pages } for non-empty groups only.
export function groupPagesByType(pages) {
    const map = {}
    for (const page of pages) {
        if (!map[page.type]) map[page.type] = []
        map[page.type].push(page)
    }
    return TYPE_ORDER
        .filter(type => map[type]?.length)
        .map(type => ({ type, label: TYPE_LABELS[type] ?? type, pages: map[type] }))
}
