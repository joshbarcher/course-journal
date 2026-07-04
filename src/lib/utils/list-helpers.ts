// Ported verbatim from public/js/views/list.js's exported pure helpers —
// no DOM, fully testable, unchanged logic. Generic over T so both the
// loosely-shaped test fixtures and the real ListItem type from the schema
// work without casting.
export function sortedItems<T extends { order?: number }>(page: { items: T[] }): T[] {
	return [...page.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function reorderItems<T>(items: T[], fromIdx: number, toIdx: number): (T & { order: number })[] {
	const result = [...items];
	const [moved] = result.splice(fromIdx, 1);
	result.splice(toIdx, 0, moved);
	return result.map((item, i) => ({ ...item, order: i }));
}
