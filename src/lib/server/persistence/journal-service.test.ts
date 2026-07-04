// Ported from src/tests/journalService.test.js — minimal-churn port: only
// the node:test -> vitest import swap, assertion bodies unchanged. A couple
// of new subtitle-focused round-trip assertions are added at the bottom
// (see "subtitle field"), covering the schema addition from this session.
import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { JournalService } from './journal-service';

function tmpPath() {
	return path.join(os.tmpdir(), `journal-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

async function cleanup(filePath: string) {
	await fsp.unlink(filePath).catch(() => {});
	await fsp.unlink(filePath + '.checkpoint.json').catch(() => {});
}

describe('JournalService', () => {
	let service: JournalService;
	let filePath: string;

	beforeEach(async () => {
		filePath = tmpPath();
		service = new JournalService(filePath);
		await service.load();
	});

	afterEach(async () => {
		await service.close();
		await cleanup(filePath);
	});

	describe('initial state', () => {
		it('starts with an empty pages array', () => {
			assert.deepEqual(service.getAll(), []);
		});
	});

	describe('create', () => {
		it('returns a page with a generated id', async () => {
			const page = await service.create({ type: 'notes', title: 'Research' });
			assert.ok(page.id);
			assert.equal(typeof page.id, 'string');
		});

		it('sets type and title from input', async () => {
			const page = await service.create({ type: 'notes', title: 'Research' });
			assert.equal(page.type, 'notes');
			assert.equal(page.title, 'Research');
		});

		it('applies type defaults for list', async () => {
			const page = await service.create({ type: 'list', title: 'Topics' });
			assert.equal((page as any).ordered, true);
			assert.deepEqual((page as any).items, []);
		});

		it('applies type defaults for progress', async () => {
			const page = await service.create({ type: 'progress', title: 'Slides' });
			assert.deepEqual((page as any).tasks, []);
		});

		it('applies type defaults for notes', async () => {
			const page = await service.create({ type: 'notes', title: 'Things' });
			assert.deepEqual((page as any).notes, []);
		});

		it('applies type defaults for page', async () => {
			const page = await service.create({ type: 'page', title: 'Lecture' });
			assert.equal((page as any).content, '');
		});

		it('sets createdAt and updatedAt as ISO strings', async () => {
			const page = await service.create({ type: 'notes', title: 'X' });
			assert.ok(new Date(page.createdAt).getTime());
			assert.ok(new Date(page.updatedAt).getTime());
		});

		it('adds the page to getAll()', async () => {
			await service.create({ type: 'notes', title: 'A' });
			await service.create({ type: 'notes', title: 'B' });
			assert.equal(service.getAll().length, 2);
		});

		it('allows extra fields on create', async () => {
			const page = await service.create({ type: 'list', title: 'T', ordered: false });
			assert.equal((page as any).ordered, false);
		});
	});

	describe('getById', () => {
		it('finds a page by id', async () => {
			const created = await service.create({ type: 'notes', title: 'Find me' });
			const found = service.getById(created.id);
			assert.equal(found!.title, 'Find me');
		});

		it('returns null for unknown id', () => {
			assert.equal(service.getById('nonexistent'), null);
		});
	});

	describe('update', () => {
		it('updates allowed fields', async () => {
			const page = await service.create({ type: 'notes', title: 'Original' });
			const updated = await service.update(page.id, { title: 'Updated' });
			assert.equal(updated!.title, 'Updated');
		});

		it('refreshes updatedAt', async () => {
			const page = await service.create({ type: 'notes', title: 'X' });
			await new Promise((r) => setTimeout(r, 5));
			const updated = await service.update(page.id, { title: 'Y' });
			assert.ok(updated!.updatedAt >= page.updatedAt);
		});

		it('does not change type even if sent', async () => {
			const page = await service.create({ type: 'notes', title: 'X' });
			const updated = await service.update(page.id, { type: 'page', title: 'Y' });
			assert.equal(updated!.type, 'notes');
		});

		it('does not change id even if sent', async () => {
			const page = await service.create({ type: 'notes', title: 'X' });
			const updated = await service.update(page.id, { id: 'hacked', title: 'Y' });
			assert.equal(updated!.id, page.id);
		});

		it('does not change createdAt even if sent', async () => {
			const page = await service.create({ type: 'notes', title: 'X' });
			const updated = await service.update(page.id, { createdAt: '1970-01-01T00:00:00.000Z' });
			assert.equal(updated!.createdAt, page.createdAt);
		});

		it('returns null for unknown id', async () => {
			const result = await service.update('nonexistent', { title: 'Y' });
			assert.equal(result, null);
		});
	});

	describe('remove', () => {
		it('removes a page and returns true', async () => {
			const page = await service.create({ type: 'notes', title: 'Delete me' });
			const result = await service.remove(page.id);
			assert.equal(result, true);
			assert.equal(service.getById(page.id), null);
		});

		it('returns false for unknown id', async () => {
			const result = await service.remove('nonexistent');
			assert.equal(result, false);
		});

		it('does not affect other pages when one is removed', async () => {
			const a = await service.create({ type: 'notes', title: 'A' });
			const b = await service.create({ type: 'notes', title: 'B' });
			await service.remove(a.id);
			assert.equal(service.getAll().length, 1);
			assert.equal(service.getAll()[0].id, b.id);
		});
	});

	describe('persistence', () => {
		it('reloads pages from disk after flush', async () => {
			const page = await service.create({ type: 'notes', title: 'Persisted' });
			await service.flush();

			const service2 = new JournalService(filePath);
			await service2.load();
			const found = service2.getById(page.id);
			assert.ok(found);
			assert.equal(found!.title, 'Persisted');
			await service2.close();
		});
	});

	describe('subtitle field (Zod schema round-trip)', () => {
		it('backfills a missing subtitle to "" when reloaded from disk', async () => {
			// Simulates a pre-existing on-disk record from before the subtitle
			// field existed: written without `subtitle` at all.
			const page = await service.create({
				type: 'progress',
				title: 'Slides',
				tasks: [{ id: 't1', title: 'Task 1', state: null }]
			});
			await service.flush();

			const reloaded = new JournalService(filePath);
			await reloaded.load();
			const found = reloaded.getById(page.id) as any;
			assert.equal(found.tasks[0].subtitle, '');
			await reloaded.close();
		});

		it('round-trips an explicit subtitle and optional flag through a flush+reload', async () => {
			const page = await service.create({
				type: 'progress-bars',
				title: 'Modules',
				bars: [
					{
						id: 'b1',
						title: 'Mod 1',
						steps: [{ id: 's1', title: 'Step 1', subtitle: 'Read chapter 1', state: 'working', optional: true }]
					}
				]
			});
			await service.flush();

			const reloaded = new JournalService(filePath);
			await reloaded.load();
			const found = reloaded.getById(page.id) as any;
			assert.equal(found.bars[0].steps[0].subtitle, 'Read chapter 1');
			assert.equal(found.bars[0].steps[0].optional, true);
			await reloaded.close();
		});

		it('does not add an "optional" key to steps that never had one', async () => {
			const page = await service.create({
				type: 'progress-bars',
				title: 'Modules',
				bars: [{ id: 'b1', title: 'Mod 1', steps: [{ id: 's1', title: 'Step 1', state: null }] }]
			});
			await service.flush();

			const reloaded = new JournalService(filePath);
			await reloaded.load();
			const found = reloaded.getById(page.id) as any;
			assert.equal('optional' in found.bars[0].steps[0], false);
			await reloaded.close();
		});
	});
});
