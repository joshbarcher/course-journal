import { escapeHtml, progressPercent } from '../utils.js'
import { getCourseId } from '../course-context.js'
import { heatmapRows } from './progress-helpers.js'

const BADGE_THEMES = ['badge--teal', 'badge--purple', 'badge--blue', 'badge--rose', 'badge--amber']
const BADGE_ICONS  = ['✦', '◈', '✸', '⬡', '◆', '✤']

export function renderHeatmap(pages, container) {
    container.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'page-header'
    header.innerHTML = `
        <h1 class="page-title">Progress</h1>
        <p class="page-subtitle">(Heatmap)</p>`
    container.appendChild(header)

    const rows = heatmapRows(pages)

    if (!rows.length) {
        const empty = document.createElement('p')
        empty.className = 'page-subtitle'
        empty.textContent = 'No progress pages yet. Create a Progress or Multi-Bar page to see data here.'
        container.appendChild(empty)
        return
    }

    const grid = document.createElement('div')
    grid.className = 'heatmap-grid'
    container.appendChild(grid)

    const cid = getCourseId()
    for (const row of rows) {
        const href = cid ? `#c:${cid}:${row.id}` : `#${row.id}`
        const rowEl = document.createElement('div')
        rowEl.className = 'heatmap-row'

        const labelLink = document.createElement('a')
        labelLink.className = 'heatmap-label'
        labelLink.href = href
        labelLink.title = row.title
        labelLink.textContent = row.title
        rowEl.appendChild(labelLink)

        const cellsEl = document.createElement('div')
        cellsEl.className = 'heatmap-cells'

        if (!row.cells.length) {
            const empty = document.createElement('div')
            empty.className = 'heatmap-cell heatmap-cell--dim'
            empty.title = `${row.title} · no tasks`
            cellsEl.appendChild(empty)
        } else {
            for (const cell of row.cells) {
                const cellEl = document.createElement('a')
                cellEl.className = 'heatmap-cell'
                cellEl.href = href
                cellEl.style.background = cell.color
                cellEl.title = [
                    row.title,
                    cell.label || `#${cell.num}`,
                    cell.stateLabel,
                ].filter(Boolean).join(' · ')
                cellsEl.appendChild(cellEl)
            }
        }

        rowEl.appendChild(cellsEl)
        grid.appendChild(rowEl)
    }

    _renderBadges(pages, container)
}

function _renderBadges(pages, container) {
    const eligible  = pages.filter(p => p.type === 'progress' || p.type === 'progress-bars')
    const completed = eligible.filter(p => progressPercent(p) === 100)
    if (!completed.length) return

    const section = document.createElement('div')
    section.className = 'badges-section'

    const heading = document.createElement('div')
    heading.className = 'badges-heading'
    heading.textContent = 'Achievements'
    section.appendChild(heading)

    const row = document.createElement('div')
    row.className = 'badges-row'
    section.appendChild(row)

    const allDone = completed.length === eligible.length && eligible.length > 0
    if (allDone) {
        row.appendChild(_buildBadge('★', 'Course\nComplete', 'badge--gold badge--star', true))
    }

    completed.forEach((page, i) => {
        const theme = BADGE_THEMES[i % BADGE_THEMES.length]
        const icon  = BADGE_ICONS[i % BADGE_ICONS.length]
        row.appendChild(_buildBadge(icon, page.title, theme))
    })

    container.appendChild(section)
}

function _buildBadge(icon, title, themeClass, large = false) {
    const wrap = document.createElement('div')
    wrap.className = 'badge-wrap'
    // stagger animation delay by position in DOM
    wrap.style.animationDelay = `${Math.random() * 0.15}s`

    const badge = document.createElement('div')
    badge.className = `badge ${themeClass}${large ? ' badge--large' : ''}`

    const iconEl = document.createElement('div')
    iconEl.className = 'badge-icon'
    iconEl.textContent = icon
    badge.appendChild(iconEl)
    wrap.appendChild(badge)

    const label = document.createElement('div')
    label.className = 'badge-label'
    label.textContent = title
    wrap.appendChild(label)

    return wrap
}
