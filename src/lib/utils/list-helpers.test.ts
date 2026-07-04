// Ported from src/tests/list.test.js — minimal-churn port (node:test -> vitest).
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { sortedItems, reorderItems } from './list-helpers';

function item(id: string, order: number, title = '') {
	return { id, order, title, subtasks: [] as string[] };
}

describe('sortedItems', () => {
	it('returns empty array for page with no items', () => {
		assert.deepEqual(sortedItems({ items: [] }), []);
	});

	it('sorts by order field ascending', () => {
		const page = { items: [item('c', 2), item('a', 0), item('b', 1)] };
		const result = sortedItems(page);
		assert.deepEqual(result.map((i) => i.id), ['a', 'b', 'c']);
	});

	it('does not mutate the original items array', () => {
		const items = [item('b', 1), item('a', 0)];
		sortedItems({ items });
		assert.equal(items[0].id, 'b');
	});

	it('treats missing order as 0', () => {
		const page: { items: { id: string; order?: number; title: string }[] } = {
			items: [{ id: 'x', title: '' }, item('a', 0)]
		};
		const result = sortedItems(page);
		assert.equal(result.length, 2);
	});
});

describe('reorderItems', () => {
	it('moves an item forward in the list', () => {
		const items = [item('a', 0), item('b', 1), item('c', 2)];
		const result = reorderItems(items, 0, 2);
		assert.deepEqual(result.map((i) => i.id), ['b', 'c', 'a']);
	});

	it('moves an item backward in the list', () => {
		const items = [item('a', 0), item('b', 1), item('c', 2)];
		const result = reorderItems(items, 2, 0);
		assert.deepEqual(result.map((i) => i.id), ['c', 'a', 'b']);
	});

	it('reassigns order values to match new positions', () => {
		const items = [item('a', 0), item('b', 1), item('c', 2)];
		const result = reorderItems(items, 0, 2);
		assert.deepEqual(result.map((i) => i.order), [0, 1, 2]);
	});

	it('does not mutate the original array', () => {
		const items = [item('a', 0), item('b', 1)];
		reorderItems(items, 0, 1);
		assert.equal(items[0].id, 'a');
	});

	it('handles adjacent swap', () => {
		const items = [item('a', 0), item('b', 1)];
		const result = reorderItems(items, 0, 1);
		assert.deepEqual(result.map((i) => i.id), ['b', 'a']);
	});
});
