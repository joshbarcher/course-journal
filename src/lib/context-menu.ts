// Ported from public/js/views/context-menu.js — already a self-contained
// imperative DOM builder with no framework dependency, so it ports as a
// plain TS module rather than a Svelte component. Reused wherever the old
// app used a right-click/⋮ menu (Sidebar item options; in a later pass,
// the temporary inline buttons in Progress/ProgressBars from M3 could be
// swapped over to this too).
export type ContextMenuItem =
	| 'separator'
	| {
			label: string;
			danger?: boolean;
			action?: () => void;
			submenu?: ContextMenuItem[];
	  };

let active: HTMLElement | null = null;
let activeSub: HTMLElement | null = null;

function removeSub() {
	if (activeSub) {
		activeSub.remove();
		activeSub = null;
	}
}

function remove() {
	removeSub();
	if (active) {
		active.remove();
		active = null;
	}
}

function buildButton(item: Exclude<ContextMenuItem, 'separator'>, onDone: () => void): HTMLButtonElement {
	const btn = document.createElement('button');
	btn.className = 'ctx-menu-item' + (item.danger ? ' ctx-menu-item--danger' : '');
	btn.textContent = item.label;
	btn.addEventListener('mousedown', (e) => e.stopPropagation());
	btn.addEventListener('click', () => {
		onDone();
		item.action?.();
	});
	return btn;
}

export function showContextMenu(event: MouseEvent, items: ContextMenuItem[]): void {
	event.preventDefault();
	event.stopPropagation();
	remove();

	const menu = document.createElement('div');
	menu.className = 'ctx-menu';
	active = menu;

	for (const item of items) {
		if (item === 'separator') {
			const sep = document.createElement('div');
			sep.className = 'ctx-menu-sep';
			menu.appendChild(sep);
			continue;
		}

		const hasSub = Array.isArray(item.submenu) && item.submenu.length > 0;

		if (hasSub) {
			const btn = document.createElement('button');
			btn.className = 'ctx-menu-item ctx-menu-item--has-sub';
			const labelSpan = document.createElement('span');
			labelSpan.textContent = item.label;
			const arrowSpan = document.createElement('span');
			arrowSpan.className = 'ctx-menu-arrow';
			arrowSpan.textContent = '▶';
			btn.appendChild(labelSpan);
			btn.appendChild(arrowSpan);
			btn.addEventListener('mousedown', (e) => e.stopPropagation());

			btn.addEventListener('mouseenter', () => {
				removeSub();
				const sub = document.createElement('div');
				sub.className = 'ctx-menu ctx-submenu';
				activeSub = sub;

				for (const si of item.submenu!) {
					if (si === 'separator') {
						const sep = document.createElement('div');
						sep.className = 'ctx-menu-sep';
						sub.appendChild(sep);
						continue;
					}
					sub.appendChild(buildButton(si, remove));
				}

				document.body.appendChild(sub);

				requestAnimationFrame(() => {
					const btnR = btn.getBoundingClientRect();
					const subR = sub.getBoundingClientRect();
					let left = btnR.right + 4;
					let top = btnR.top;
					if (left + subR.width > window.innerWidth) left = btnR.left - subR.width - 4;
					if (top + subR.height > window.innerHeight) top = window.innerHeight - subR.height - 8;
					sub.style.left = `${left}px`;
					sub.style.top = `${top}px`;
				});

				sub.addEventListener('mouseleave', (e) => {
					if (!menu.contains(e.relatedTarget as Node)) removeSub();
				});
			});

			btn.addEventListener('mouseleave', (e) => {
				if (activeSub && activeSub.contains(e.relatedTarget as Node)) return;
				setTimeout(() => {
					if (activeSub && !activeSub.matches(':hover')) removeSub();
				}, 80);
			});

			menu.appendChild(btn);
		} else {
			const btn = buildButton(item, remove);
			btn.addEventListener('mouseenter', () => removeSub());
			menu.appendChild(btn);
		}
	}

	menu.style.position = 'fixed';
	menu.style.left = `${event.clientX}px`;
	menu.style.top = `${event.clientY}px`;
	document.body.appendChild(menu);

	requestAnimationFrame(() => {
		const r = menu.getBoundingClientRect();
		if (r.right > window.innerWidth) menu.style.left = `${window.innerWidth - r.width - 8}px`;
		if (r.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - r.height - 8}px`;
	});

	const onDown = (e: MouseEvent) => {
		const inMenu = menu.contains(e.target as Node) || (activeSub && activeSub.contains(e.target as Node));
		if (!inMenu) {
			remove();
			cleanup();
		}
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			remove();
			cleanup();
		}
	};
	const cleanup = () => {
		document.removeEventListener('mousedown', onDown);
		document.removeEventListener('keydown', onKey);
	};
	document.addEventListener('mousedown', onDown);
	document.addEventListener('keydown', onKey);
}
