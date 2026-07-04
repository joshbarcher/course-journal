// New tests (not a port) — hand-authored fixtures matching each of the 5
// real on-disk page shapes, confirming no data loss through the schema and
// correct discrimination by `type`. Covers the subtitle/optional edge cases
// documented in the migration plan.
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PageSchema, PagesFileSchema } from './page';

const base = { id: 'p1', title: 'A Page', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

describe('PageSchema', () => {
	it('parses a list page and preserves plain-string subtasks', () => {
		const fixture = {
			...base,
			type: 'list',
			ordered: true,
			items: [{ id: 'i1', title: 'Item 1', subtasks: ['sub a', 'sub b'], order: 0, done: false }]
		};
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.type, 'list');
		assert.deepEqual(parsed.items[0].subtasks, ['sub a', 'sub b']);
	});

	it('parses a progress page and backfills a missing subtitle to ""', () => {
		const fixture = {
			...base,
			type: 'progress',
			notes: '',
			tasks: [{ id: 't1', title: 'Task 1', state: 'done' }] // no subtitle — pre-existing on-disk shape
		};
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.tasks[0].subtitle, '');
	});

	it('preserves an explicit subtitle and true optional flag on a progress task', () => {
		const fixture = {
			...base,
			type: 'progress',
			notes: '',
			tasks: [{ id: 't1', title: 'Task 1', subtitle: 'Read pages 1-10', state: 'working', optional: true }]
		};
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.tasks[0].subtitle, 'Read pages 1-10');
		assert.equal(parsed.tasks[0].optional, true);
	});

	it('does not inject an optional key onto a task that never had one', () => {
		const fixture = {
			...base,
			type: 'progress',
			notes: '',
			tasks: [{ id: 't1', title: 'Task 1', state: null }]
		};
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal('optional' in parsed.tasks[0], false);
	});

	it('parses a progress-bars page with nested bars/steps', () => {
		const fixture = {
			...base,
			type: 'progress-bars',
			notes: '',
			bars: [
				{
					id: 'b1',
					title: 'Bar 1',
					steps: [{ id: 's1', title: 'Step 1', subtitle: 'Do the thing', state: 'started' }]
				}
			]
		};
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.bars[0].steps[0].subtitle, 'Do the thing');
	});

	it('parses a notes page (object notes, distinct from list subtasks)', () => {
		const fixture = {
			...base,
			type: 'notes',
			notes: [{ id: 'n1', text: 'Hello', createdAt: '2026-01-01T00:00:00.000Z' }]
		};
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.notes[0].text, 'Hello');
	});

	it('parses a rich-text page', () => {
		const fixture = { ...base, type: 'page', content: '<p>Hello</p>' };
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.content, '<p>Hello</p>');
	});

	it('preserves unknown keys via passthrough (does not silently strip fields)', () => {
		const fixture = { ...base, type: 'page', content: '<p>Hi</p>', futureField: 'from a later version' };
		const parsed = PageSchema.parse(fixture) as any;
		assert.equal(parsed.futureField, 'from a later version');
	});

	it('rejects a page whose type is not one of the five known types', () => {
		const fixture = { ...base, type: 'unknown-type', content: '' };
		assert.throws(() => PageSchema.parse(fixture));
	});
});

describe('PagesFileSchema', () => {
	it('parses a full pages.json-equivalent file with a mix of types', () => {
		const fixture = {
			pages: [
				{ ...base, id: 'p1', type: 'notes', notes: [] },
				{ ...base, id: 'p2', type: 'list', ordered: true, items: [] }
			]
		};
		const parsed = PagesFileSchema.parse(fixture);
		assert.equal(parsed.pages.length, 2);
	});
});
