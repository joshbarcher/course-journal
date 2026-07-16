// Adversarial tests (new, not a port) — deep-copy independence, progress-state
// reset coverage for list/progress-bars, and immutable-field enforcement in
// CourseService. Same temp-dir convention as course-service.test.ts.
import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { CourseService } from './course-service';

function tmpDir() {
	return path.join(os.tmpdir(), `course-adv-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function cleanupDir(dir: string) {
	await fsp.rm(dir, { recursive: true, force: true });
}

describe('CourseService (adversarial)', () => {
	let service: CourseService;
	let baseDir: string;

	beforeEach(async () => {
		baseDir = tmpDir();
		service = new CourseService(baseDir);
		await service.load();
	});

	afterEach(async () => {
		await service.close();
		await cleanupDir(baseDir);
	});

	describe('copy — progress-state reset', () => {
		it('resets list item done flags to false on the copy but leaves the source alone', async () => {
			const source = await service.create({ title: 'Src' });
			const journal = service.getJournal(source.id);
			await journal.create({
				type: 'list',
				title: 'Topics',
				ordered: true,
				items: [
					{ id: 'i1', title: 'One', subtasks: [], order: 0, done: true },
					{ id: 'i2', title: 'Two', subtasks: [], order: 1, done: true }
				]
			});

			const copy = await service.copy(source.id);
			const copyItems = (service.getJournal(copy!.id).getAll()[0] as any).items;
			assert.deepEqual(copyItems.map((i: any) => i.done), [false, false]);
			// Source untouched.
			const srcItems = (service.getJournal(source.id).getAll()[0] as any).items;
			assert.deepEqual(srcItems.map((i: any) => i.done), [true, true]);
		});

		it('gives copied lecture-plan cards fresh ids that do not collide with the source', async () => {
			const source = await service.create({ title: 'Src' });
			const lp = service.getLecturePlans(source.id);
			const plan = await lp.create('Plan');
			const card = await lp.addCard(plan.id, plan.weeks[0].id, { day: 'mon', durationHours: 1 });

			const copy = await service.copy(source.id);
			const copyPlans = service.getLecturePlans(copy!.id).getAll();
			assert.equal(copyPlans.length, 1);
			const copyCard = copyPlans[0].weeks[0].days.mon[0];
			assert.notEqual(copyPlans[0].id, plan.id);
			assert.notEqual(copyPlans[0].weeks[0].id, plan.weeks[0].id);
			assert.notEqual(copyCard.id, card!.id);
			assert.equal(copyCard.durationHours, 1);
		});

		it('mutating a copied plan does not bleed back into the source plan', async () => {
			const source = await service.create({ title: 'Src' });
			const lp = service.getLecturePlans(source.id);
			const plan = await lp.create('Plan');
			await lp.addCard(plan.id, plan.weeks[0].id, { day: 'mon', durationHours: 1 });

			const copy = await service.copy(source.id);
			const copyLp = service.getLecturePlans(copy!.id);
			const copyPlanId = copyLp.getAll()[0].id;
			const copyCardId = copyLp.getAll()[0].weeks[0].days.mon[0].id;
			await copyLp.removeCard(copyPlanId, copyCardId);

			// Source still has its card.
			assert.equal(service.getLecturePlans(source.id).getAll()[0].weeks[0].days.mon.length, 1);
		});
	});

	describe('remove — cleanup', () => {
		it('drops both the journal and the lecture-plans service from memory', async () => {
			const course = await service.create({ title: 'Temp' });
			await service.remove(course.id);
			assert.throws(() => service.getJournal(course.id), /No journal/);
			assert.throws(() => service.getLecturePlans(course.id), /No lecture plans/);
		});

		it('deletes the per-course journal file from disk', async () => {
			const course = await service.create({ title: 'Temp' });
			// Write a page so the journal's ManagedFile actually persists a
			// file (an untouched empty journal is never flushed to disk).
			await service.getJournal(course.id).create({ type: 'notes', title: 'N' });
			await service.flush();
			const journalPath = path.join(baseDir, 'courses', `${course.id}.json`);
			await fsp.access(journalPath); // exists now
			await service.remove(course.id);
			await assert.rejects(fsp.access(journalPath));
		});
	});

	describe('immutable-field enforcement', () => {
		it('update cannot rewrite id or createdAt but can rename', async () => {
			const course = await service.create({ title: 'Old' });
			const updated = await service.update(course.id, {
				id: 'hacked',
				createdAt: '1970-01-01T00:00:00.000Z',
				title: 'New'
			});
			assert.equal(updated!.id, course.id);
			assert.equal(updated!.createdAt, course.createdAt);
			assert.equal(updated!.title, 'New');
		});
	});
});
