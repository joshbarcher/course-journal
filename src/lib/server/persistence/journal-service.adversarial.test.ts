// Adversarial tests (new, not a port) — hunt for real bugs in JournalService:
// reorder id-set edge cases, patch immutability under hostile input, unicode /
// very long titles, and corrupt-file recovery. Same temp-file convention as
// journal-service.test.ts.
import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { JournalService } from './journal-service';

function tmpPath() {
	return path.join(os.tmpdir(), `journal-adv-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

async function cleanup(filePath: string) {
	await fsp.unlink(filePath).catch(() => {});
	await fsp.unlink(filePath + '.checkpoint.json').catch(() => {});
}

describe('JournalService (adversarial)', () => {
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

	describe('reorder', () => {
		it('does NOT duplicate a page when the same id appears twice in ids', async () => {
			const a = await service.create({ type: 'notes', title: 'A' });
			const b = await service.create({ type: 'notes', title: 'B' });
			await service.reorder([a.id, a.id]);
			const all = service.getAll();
			// Regression guard: a duplicated id must not clone the page.
			assert.equal(all.length, 2);
			assert.equal(all.filter((p) => p.id === a.id).length, 1);
			assert.deepEqual(all.map((p) => p.id).sort(), [a.id, b.id].sort());
		});

		it('applies the requested order and appends unmentioned pages', async () => {
			const a = await service.create({ type: 'notes', title: 'A' });
			const b = await service.create({ type: 'notes', title: 'B' });
			const c = await service.create({ type: 'notes', title: 'C' });
			await service.reorder([c.id, a.id]); // b omitted
			const ids = service.getAll().map((p) => p.id);
			assert.deepEqual(ids, [c.id, a.id, b.id]);
		});

		it('ignores unknown ids without inventing pages', async () => {
			const a = await service.create({ type: 'notes', title: 'A' });
			await service.reorder(['ghost-1', a.id, 'ghost-2']);
			const all = service.getAll();
			assert.equal(all.length, 1);
			assert.equal(all[0].id, a.id);
		});

		it('an empty ids array leaves every page (in original order)', async () => {
			const a = await service.create({ type: 'notes', title: 'A' });
			const b = await service.create({ type: 'notes', title: 'B' });
			await service.reorder([]);
			assert.deepEqual(service.getAll().map((p) => p.id), [a.id, b.id]);
		});
	});

	describe('hostile / edge input on create + update', () => {
		it('preserves a unicode + emoji + very long title through a flush/reload', async () => {
			const title = '数学 📚 ' + 'x'.repeat(20_000);
			const page = await service.create({ type: 'notes', title });
			await service.flush();
			const reloaded = new JournalService(filePath);
			await reloaded.load();
			assert.equal(reloaded.getById(page.id)!.title, title);
			await reloaded.close();
		});

		it('an update that tries to smuggle id/type/createdAt changes none of them', async () => {
			const page = await service.create({ type: 'notes', title: 'X' });
			const updated = await service.update(page.id, {
				id: 'hacked',
				type: 'list',
				createdAt: '1970-01-01T00:00:00.000Z',
				title: 'Y'
			});
			assert.equal(updated!.id, page.id);
			assert.equal(updated!.type, 'notes');
			assert.equal(updated!.createdAt, page.createdAt);
			assert.equal(updated!.title, 'Y');
		});

		it('create does not let a caller override the generated id or timestamps via extra fields', async () => {
			const page = await service.create({
				type: 'notes',
				title: 'X',
				id: 'client-supplied',
				createdAt: 'nope'
			} as never);
			assert.notEqual(page.id, 'client-supplied');
			assert.notEqual(page.createdAt, 'nope');
			assert.ok(!Number.isNaN(new Date(page.createdAt).getTime()));
		});
	});

	describe('corrupt-file recovery', () => {
		it('recovers to the empty default when the on-disk JSON is syntactically broken', async () => {
			await fsp.writeFile(filePath, '{ this is not valid json ');
			const svc = new JournalService(filePath);
			await svc.load();
			assert.deepEqual(svc.getAll(), []);
			await svc.close();
		});

		it('recovers when the JSON is valid but violates the page schema', async () => {
			// `pages` present but an item is missing required fields for its type.
			await fsp.writeFile(filePath, JSON.stringify({ pages: [{ id: 'x', type: 'list' }] }));
			const svc = new JournalService(filePath);
			await svc.load();
			assert.deepEqual(svc.getAll(), []);
			await svc.close();
		});
	});
});
