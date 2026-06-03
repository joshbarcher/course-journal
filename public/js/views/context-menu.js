let _active = null
let _activeSub = null

function _removeSub() {
    if (_activeSub) { _activeSub.remove(); _activeSub = null }
}

function _remove() {
    _removeSub()
    if (_active) { _active.remove(); _active = null }
}

function _buildButton(item, onDone) {
    const btn = document.createElement('button')
    btn.className = 'ctx-menu-item' + (item.danger ? ' ctx-menu-item--danger' : '')
    btn.textContent = item.label
    btn.addEventListener('mousedown', e => e.stopPropagation())
    btn.addEventListener('click', () => { onDone(); item.action() })
    return btn
}

export function showContextMenu(event, items) {
    event.preventDefault()
    event.stopPropagation()
    _remove()

    const menu = document.createElement('div')
    menu.className = 'ctx-menu'
    _active = menu

    for (const item of items) {
        if (item === 'separator') {
            const sep = document.createElement('div')
            sep.className = 'ctx-menu-sep'
            menu.appendChild(sep)
            continue
        }

        const hasSub = Array.isArray(item.submenu) && item.submenu.length > 0

        if (hasSub) {
            const btn = document.createElement('button')
            btn.className = 'ctx-menu-item ctx-menu-item--has-sub'
            const labelSpan = document.createElement('span')
            labelSpan.textContent = item.label
            const arrowSpan = document.createElement('span')
            arrowSpan.className = 'ctx-menu-arrow'
            arrowSpan.textContent = '▶'
            btn.appendChild(labelSpan)
            btn.appendChild(arrowSpan)
            btn.addEventListener('mousedown', e => e.stopPropagation())

            btn.addEventListener('mouseenter', () => {
                _removeSub()
                const sub = document.createElement('div')
                sub.className = 'ctx-menu ctx-submenu'
                _activeSub = sub

                for (const si of item.submenu) {
                    if (si === 'separator') {
                        const sep = document.createElement('div')
                        sep.className = 'ctx-menu-sep'
                        sub.appendChild(sep)
                        continue
                    }
                    sub.appendChild(_buildButton(si, _remove))
                }

                document.body.appendChild(sub)

                requestAnimationFrame(() => {
                    const btnR = btn.getBoundingClientRect()
                    const subR = sub.getBoundingClientRect()
                    let left = btnR.right + 4
                    let top  = btnR.top
                    if (left + subR.width  > window.innerWidth)  left = btnR.left - subR.width - 4
                    if (top  + subR.height > window.innerHeight) top  = window.innerHeight - subR.height - 8
                    sub.style.left = `${left}px`
                    sub.style.top  = `${top}px`
                })

                sub.addEventListener('mouseleave', (e) => {
                    if (!menu.contains(e.relatedTarget)) _removeSub()
                })
            })

            btn.addEventListener('mouseleave', (e) => {
                if (_activeSub && _activeSub.contains(e.relatedTarget)) return
                setTimeout(() => { if (_activeSub && !_activeSub.matches(':hover')) _removeSub() }, 80)
            })

            menu.appendChild(btn)
        } else {
            const btn = _buildButton(item, _remove)
            btn.addEventListener('mouseenter', () => _removeSub())
            menu.appendChild(btn)
        }
    }

    menu.style.position = 'fixed'
    menu.style.left = `${event.clientX}px`
    menu.style.top  = `${event.clientY}px`
    document.body.appendChild(menu)

    requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect()
        if (r.right  > window.innerWidth)  menu.style.left = `${window.innerWidth  - r.width  - 8}px`
        if (r.bottom > window.innerHeight) menu.style.top  = `${window.innerHeight - r.height - 8}px`
    })

    const onDown = e => {
        const inMenu = menu.contains(e.target) || (_activeSub && _activeSub.contains(e.target))
        if (!inMenu) { _remove(); cleanup() }
    }
    const onKey = e => { if (e.key === 'Escape') { _remove(); cleanup() } }
    const cleanup = () => {
        document.removeEventListener('mousedown', onDown)
        document.removeEventListener('keydown',   onKey)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown',   onKey)
}
