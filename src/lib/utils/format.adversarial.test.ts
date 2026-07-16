// Adversarial tests (new) for the progress math in format.ts — the
// progressPercent / isSuperComplete branches that groupPagesByType's ported
// suite never touches. Focus: division-by-zero guards, rounding, optional/
// required interplay, and missing arrays.
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { progressPercent, isSuperComplete } from './format';
import type { Page } from '$lib/schemas/page';

const base = { id: 'p', title: 'T', createdAt: '', updatedAt: '' };

function progress(tasks: any[]): Page {
	return { ...base, type: 'progress', notes: '', tasks } as unknown as Page;
}
function bars(barsArr: any[]): Page {
	return { ...base, type: 'progress-bars', notes: '', bars: barsArr } as unknown as Page;
}
function list(items: any[]): Page {
	return { ...base, type: 'list', ordered: true, items } as unknown as Page;
}

describe('progressPercent', () => {
	it('is 0 (not NaN) for a progress page with only optional tasks', () => {
		const p = progress([{ id: 't', title: 'x', state: 'done', optional: true }]);
		assert.equal(progressPercent(p), 0);
	});

	it('ignores optional tasks in the denominator', () => {
		const p = progress([
			{ id: 'a', title: 'a', state: 'done' },
			{ id: 'b', title: 'b', state: null },
			{ id: 'c', title: 'c', state: 'done', optional: true } // optional -> excluded
		]);
		// 1 of 2 required done
		assert.equal(progressPercent(p), 50);
	});

	it('rounds to the nearest integer (1 of 3 -> 33)', () => {
		const p = progress([
			{ id: 'a', title: 'a', state: 'done' },
			{ id: 'b', title: 'b', state: null },
			{ id: 'c', title: 'c', state: null }
		]);
		assert.equal(progressPercent(p), 33);
	});

	it('is 0 for an empty list rather than dividing by zero', () => {
		assert.equal(progressPercent(list([])), 0);
	});

	it('counts list done items over total (2 of 4 -> 50)', () => {
		const p = list([
			{ id: '1', title: 'a', subtasks: [], order: 0, done: true },
			{ id: '2', title: 'b', subtasks: [], order: 1, done: false },
			{ id: '3', title: 'c', subtasks: [], order: 2, done: true },
			{ id: '4', title: 'd', subtasks: [], order: 3, done: false }
		]);
		assert.equal(progressPercent(p), 50);
	});

	it('is 0 for a progress-bars page whose required bars have no steps', () => {
		const p = bars([{ id: 'b', title: 'B', steps: [] }]);
		assert.equal(progressPercent(p), 0);
	});

	it('flattens required steps across required bars', () => {
		const p = bars([
			{ id: 'b1', title: 'B1', steps: [{ id: 's1', title: 's', state: 'done' }] },
			{ id: 'b2', title: 'B2', steps: [{ id: 's2', title: 's', state: null }] },
			{ id: 'b3', title: 'B3', optional: true, steps: [{ id: 's3', title: 's', state: 'done' }] } // optional bar excluded
		]);
		// 1 of 2 required steps done
		assert.equal(progressPercent(p), 50);
	});

	it('returns 0 for non-progress page types', () => {
		const p = { ...base, type: 'notes', notes: [] } as unknown as Page;
		assert.equal(progressPercent(p), 0);
	});
});

describe('isSuperComplete', () => {
	it('is false when there are no optional tasks at all', () => {
		assert.equal(isSuperComplete(progress([{ id: 'a', title: 'a', state: 'done' }])), false);
	});

	it('is true only when every optional task is done', () => {
		const done = progress([
			{ id: 'a', title: 'a', state: 'done' },
			{ id: 'o', title: 'o', state: 'done', optional: true }
		]);
		const notDone = progress([
			{ id: 'a', title: 'a', state: 'done' },
			{ id: 'o', title: 'o', state: null, optional: true }
		]);
		assert.equal(isSuperComplete(done), true);
		assert.equal(isSuperComplete(notDone), false);
	});

	it('combines optional bars and optional steps inside required bars', () => {
		const p = bars([
			{
				id: 'b1',
				title: 'B1',
				optional: true,
				steps: [{ id: 's1', title: 's', state: 'done' }]
			},
			{
				id: 'b2',
				title: 'B2', // required bar, but has an optional step
				steps: [
					{ id: 's2', title: 's', state: null },
					{ id: 's3', title: 's', state: 'done', optional: true }
				]
			}
		]);
		assert.equal(isSuperComplete(p), true);
	});

	it('is false when an optional step inside a required bar is not done', () => {
		const p = bars([
			{
				id: 'b2',
				title: 'B2',
				steps: [{ id: 's3', title: 's', state: null, optional: true }]
			}
		]);
		assert.equal(isSuperComplete(p), false);
	});

	it('is false for list pages (no super-complete concept)', () => {
		assert.equal(isSuperComplete(list([{ id: '1', title: 'a', subtasks: [], order: 0, done: true }])), false);
	});
});
