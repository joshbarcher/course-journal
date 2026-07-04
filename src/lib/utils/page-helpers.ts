// Pure list-manipulation functions — no DOM globals beyond the Element
// passed in, fully testable in Node via jsdom. Ported verbatim from
// public/js/views/page-helpers.js (itself ported from
// static-pages/private/editor/js/canvas.js).

export interface FlatListItem {
	depth: number;
	html: string;
}

// Walk a <ul>/<ol> element into a flat [{depth, html}] array.
export function parseListItems(ul: Element): FlatListItem[] {
	const items: FlatListItem[] = [];
	function walk(el: Element, depth: number) {
		for (const child of Array.from(el.children)) {
			if (child.tagName === 'LI') {
				const clone = child.cloneNode(true) as Element;
				for (const nested of Array.from(clone.querySelectorAll('ul, ol'))) {
					nested.remove();
				}
				items.push({ depth, html: clone.innerHTML });
				for (const nested of Array.from(child.children)) {
					if (nested.tagName === 'UL' || nested.tagName === 'OL') {
						walk(nested, depth + 1);
					}
				}
			} else if (child.tagName === 'UL' || child.tagName === 'OL') {
				walk(child, depth + 1);
			}
		}
	}
	walk(ul, 0);
	return items;
}

// Apply indent (+1 depth) or outdent (-1 depth) to items[startIdx..endIdx].
// Indent is unclamped (caller decides max depth); outdent is clamped to 0.
export function applyIndent(
	items: FlatListItem[],
	startIdx: number,
	endIdx: number,
	outdent: boolean
): FlatListItem[] {
	if (startIdx < 0 || startIdx >= items.length) return items;
	const result = items.map((item) => ({ ...item }));
	const last = Math.min(endIdx, items.length - 1);
	for (let idx = startIdx; idx <= last; idx++) {
		result[idx].depth = outdent ? Math.max(0, result[idx].depth - 1) : result[idx].depth + 1;
	}
	return result;
}

// Convert a flat [{depth, html}] array back to nested <ul>/<ol> HTML.
export function renderListItems(items: FlatListItem[], tag: string): string {
	if (!items.length) return '';
	let i = 0;
	function render(depth: number): string {
		let html = '';
		while (i < items.length) {
			const d = items[i].depth;
			if (d < depth) break;
			if (d === depth) {
				const { html: content } = items[i++];
				let children = '';
				if (i < items.length && items[i].depth > depth) {
					children = `<${tag}>${render(depth + 1)}</${tag}>`;
				}
				html += `<li>${content}${children}</li>`;
			} else {
				html += `<${tag}>${render(d)}</${tag}>`;
			}
		}
		return html;
	}
	const minDepth = items.reduce((m, it) => Math.min(m, it.depth), Infinity);
	return render(minDepth);
}
