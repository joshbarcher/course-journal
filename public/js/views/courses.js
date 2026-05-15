import { api } from '../api.js'
import { escapeHtml } from '../utils.js'
import { heatmapRows } from './progress-helpers.js'

export function renderCourses(courses, container, onNavigate) {
    container.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'page-header'
    header.innerHTML = `<h1 class="page-title">Courses</h1>`
    container.appendChild(header)

    const grid = document.createElement('div')
    grid.className = 'courses-grid'
    container.appendChild(grid)

    if (courses.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'courses-empty'
        empty.textContent = 'No courses yet. Add one below.'
        container.appendChild(empty)
    }

    for (const course of courses) {
        grid.appendChild(buildCourseCard(course, onNavigate))
    }

    const addBtn = document.createElement('button')
    addBtn.className = 'courses-add-btn'
    addBtn.textContent = '+ New Course'
    addBtn.addEventListener('click', async () => {
        const title = prompt('Course name:')
        if (!title?.trim()) return
        try {
            const course = await api.courses.create({ title: title.trim() })
            onNavigate(`c:${course.id}`)
        } catch (err) {
            alert(`Failed to create course: ${err.message}`)
        }
    })
    container.appendChild(addBtn)
}

function buildCourseCard(course, onNavigate) {
    const card = document.createElement('div')
    card.className = 'course-card'

    const nameEl = document.createElement('div')
    nameEl.className = 'course-card-name'
    nameEl.textContent = course.title
    card.appendChild(nameEl)

    const heatEl = document.createElement('div')
    heatEl.className = 'course-card-heat'
    card.appendChild(heatEl)

    const actionsEl = document.createElement('div')
    actionsEl.className = 'course-card-actions'

    const renameBtn = document.createElement('button')
    renameBtn.className = 'course-card-btn'
    renameBtn.textContent = 'Rename'
    renameBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const newTitle = prompt('New name:', course.title)
        if (!newTitle?.trim() || newTitle.trim() === course.title) return
        try {
            await api.courses.update(course.id, { title: newTitle.trim() })
            course.title = newTitle.trim()
            nameEl.textContent = course.title
        } catch (err) {
            alert(`Failed to rename: ${err.message}`)
        }
    })

    const copyBtn = document.createElement('button')
    copyBtn.className = 'course-card-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        try {
            copyBtn.textContent = 'Copying…'
            copyBtn.disabled = true
            const copy = await api.courses.copy(course.id)
            onNavigate(`c:${copy.id}`)
        } catch (err) {
            alert(`Failed to copy: ${err.message}`)
            copyBtn.textContent = 'Copy'
            copyBtn.disabled = false
        }
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'course-card-btn course-card-btn--danger'
    deleteBtn.textContent = 'Delete'
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const confirmed = await confirmDialog(`Delete "${course.title}"?`, 'This will permanently delete the course and all its pages.', 'Delete')
        if (!confirmed) return
        try {
            await api.courses.remove(course.id)
            card.remove()
        } catch (err) {
            alert(`Failed to delete: ${err.message}`)
        }
    })

    actionsEl.appendChild(renameBtn)
    actionsEl.appendChild(copyBtn)
    actionsEl.appendChild(deleteBtn)
    card.appendChild(actionsEl)

    card.addEventListener('click', () => onNavigate(`c:${course.id}`))

    loadMiniHeatmap(course.id, heatEl)

    return card
}

function confirmDialog(title, body, confirmLabel = 'Confirm') {
    return new Promise(resolve => {
        const overlay = document.createElement('div')
        overlay.className = 'dialog-overlay'

        const box = document.createElement('div')
        box.className = 'dialog-box'

        const titleEl = document.createElement('div')
        titleEl.className = 'dialog-title'
        titleEl.textContent = title

        const bodyEl = document.createElement('div')
        bodyEl.className = 'dialog-body'
        bodyEl.textContent = body

        const actions = document.createElement('div')
        actions.className = 'dialog-actions'

        const cancelBtn = document.createElement('button')
        cancelBtn.className = 'dialog-btn dialog-btn--cancel'
        cancelBtn.textContent = 'Cancel'

        const confirmBtn = document.createElement('button')
        confirmBtn.className = 'dialog-btn dialog-btn--confirm'
        confirmBtn.textContent = confirmLabel

        const close = (result) => {
            overlay.remove()
            resolve(result)
        }

        cancelBtn.addEventListener('click', () => close(false))
        confirmBtn.addEventListener('click', () => close(true))
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false) })
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey) }
            if (e.key === 'Enter')  { close(true);  document.removeEventListener('keydown', onKey) }
        })

        actions.appendChild(cancelBtn)
        actions.appendChild(confirmBtn)
        box.appendChild(titleEl)
        box.appendChild(bodyEl)
        box.appendChild(actions)
        overlay.appendChild(box)
        document.body.appendChild(overlay)

        // Focus confirm so Enter works immediately
        confirmBtn.focus()
    })
}

async function loadMiniHeatmap(courseId, container) {
    try {
        const pages = await api.pagesFor(courseId).list()
        const rows = heatmapRows(pages)

        for (const row of rows) {
            if (!row.cells.length) continue
            const rowEl = document.createElement('div')
            rowEl.className = 'mini-heat-row'
            for (const cell of row.cells) {
                const cellEl = document.createElement('div')
                cellEl.className = 'mini-heat-cell'
                cellEl.style.background = cell.color
                cellEl.title = [row.title, cell.label || `#${cell.num}`, cell.stateLabel].filter(Boolean).join(' · ')
                rowEl.appendChild(cellEl)
            }
            container.appendChild(rowEl)
        }
    } catch {
        // Silently skip — no heatmap if pages can't be loaded
    }
}
