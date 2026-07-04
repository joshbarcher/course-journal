// New tests (not a port) for the reorderById helper introduced by the
// shared dragReorder action — mirrors the existing discipline of testing
// pure list-reorder logic (see list-helpers.test.ts).
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { reorderById } from './dragReorder';

function item(id: string) {
	return { id };
}

describe('reorderById', () => {
	it('moves an item forward', () => {
		const items = [item('a'), item('b'), item('c')];
		const result = reorderById(items, (i) => i.id, 'a', 'c');
		assert.deepEqual(
			result.map((i) => i.id),
			['b', 'c', 'a']
		);
	});

	it('moves an item backward', () => {
		const items = [item('a'), item('b'), item('c')];
		const result = reorderById(items, (i) => i.id, 'c', 'a');
		assert.deepEqual(
			result.map((i) => i.id),
			['c', 'a', 'b']
		);
	});

	it('does not mutate the original array', () => {
		const items = [item('a'), item('b')];
		reorderById(items, (i) => i.id, 'a', 'b');
		assert.equal(items[0].id, 'a');
	});

	it('returns the same array reference-equal-content when ids are unknown', () => {
		const items = [item('a'), item('b')];
		const result = reorderById(items, (i) => i.id, 'x', 'y');
		assert.deepEqual(result, items);
	});
});
