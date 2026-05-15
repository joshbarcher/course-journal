import { escapeHtml } from '../utils.js'
import { heatmapRows } from './progress-helpers.js'

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

    for (const row of rows) {
        const rowEl = document.createElement('div')
        rowEl.className = 'heatmap-row'

        const labelLink = document.createElement('a')
        labelLink.className = 'heatmap-label'
        labelLink.href = `#${row.id}`
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
                cellEl.href = `#${row.id}`
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
}
