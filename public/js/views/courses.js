import { api } from '../api.js'
import { escapeHtml } from '../utils.js'
import { heatmapRows } from './progress-helpers.js'
import { confirmDialog, inputDialog, showError } from '../dialog.js'

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
        const title = await inputDialog('New Course', 'Course name…')
        if (!title) return
        try {
            const course = await api.courses.create({ title })
            onNavigate(`c:${course.id}`)
        } catch (err) {
            showError(`Failed to create course: ${err.message}`)
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
        const newTitle = await inputDialog('Rename Course', 'Course name…', course.title)
        if (!newTitle || newTitle === course.title) return
        try {
            await api.courses.update(course.id, { title: newTitle })
            course.title = newTitle
            nameEl.textContent = newTitle
        } catch (err) {
            showError(`Failed to rename: ${err.message}`)
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
            showError(`Failed to copy: ${err.message}`)
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
            showError(`Failed to delete: ${err.message}`)
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
