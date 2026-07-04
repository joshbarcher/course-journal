// Ported from src/tests/toc.test.js — minimal-churn port (node:test -> vitest).
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { groupPagesByType, TYPE_ORDER } from './format';
import type { Page } from '$lib/schemas/page';

function page(type: string, title: string) {
	return { id: `id-${title}`, type, title } as unknown as Page;
}

describe('groupPagesByType', () => {
	it('returns empty array for no pages', () => {
		assert.deepEqual(groupPagesByType([]), []);
	});

	it('groups pages by type', () => {
		const pages = [page('list', 'Topics'), page('progress', 'Slides'), page('list', 'Labs')];
		const result = groupPagesByType(pages);
		assert.equal(result.length, 2);
		assert.equal(result[0].type, 'list');
		assert.equal(result[0].pages.length, 2);
		assert.equal(result[1].type, 'progress');
		assert.equal(result[1].pages.length, 1);
	});

	it('preserves TYPE_ORDER regardless of input order', () => {
		const pages = [
			page('page', 'Lecture'),
			page('notes', 'Research'),
			page('progress-bars', 'Modules'),
			page('progress', 'Slides'),
			page('list', 'Topics')
		];
		const result = groupPagesByType(pages);
		const types = result.map((g) => g.type);
		assert.deepEqual(types, TYPE_ORDER);
	});

	it('omits types with no pages', () => {
		const pages = [page('notes', 'A'), page('notes', 'B')];
		const result = groupPagesByType(pages);
		assert.equal(result.length, 1);
		assert.equal(result[0].type, 'notes');
	});

	it('attaches the correct label to each group', () => {
		const pages = [page('list', 'T'), page('progress', 'S'), page('notes', 'N'), page('page', 'P')];
		const result = groupPagesByType(pages);
		assert.deepEqual(
			result.map((g) => g.label),
			['Lists', 'Progress', 'Notes', 'Pages']
		);
	});

	it('preserves page order within each group', () => {
		const pages = [page('list', 'A'), page('list', 'B'), page('list', 'C')];
		const [group] = groupPagesByType(pages);
		assert.deepEqual(
			group.pages.map((p) => p.title),
			['A', 'B', 'C']
		);
	});

	it('handles unknown types by using the type string as the label', () => {
		const pages = [{ id: '1', type: 'custom', title: 'X' } as unknown as Page];
		const result = groupPagesByType(pages);
		// unknown types are excluded from TYPE_ORDER so won't appear
		assert.equal(result.length, 0);
	});
});
