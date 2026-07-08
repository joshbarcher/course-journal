import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { LecturePlansService } from './lecture-plans-service';

function tmpPath() {
	return path.join(os.tmpdir(), `lecture-plans-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

async function cleanup(filePath: string) {
	await fsp.unlink(filePath).catch(() => {});
	await fsp.unlink(filePath + '.checkpoint.json').catch(() => {});
}

describe('LecturePlansService', () => {
	let service: LecturePlansService;
	let filePath: string;

	beforeEach(async () => {
		filePath = tmpPath();
		service = new LecturePlansService(filePath);
		await service.load();
	});

	afterEach(async () => {
		await service.close();
		await cleanup(filePath);
	});

	describe('initial state', () => {
		it('starts with no planners', () => {
			assert.deepEqual(service.getAll(), []);
		});
	});

	describe('create / getById / getAll', () => {
		it('creates a named plan with a generated id and a seeded empty week', async () => {
			const plan = await service.create('8 Week Summer Schedule');
			assert.ok(plan.id);
			assert.equal(plan.title, '8 Week Summer Schedule');
			assert.deepEqual(plan.meetingDays, []);
			assert.equal(plan.weeks.length, 1);
			assert.deepEqual(plan.weeks[0].days, { mon: [], tue: [], wed: [], thu: [], fri: [] });
		});

		it('accepts a client-provided id (supports optimistic UI adds)', async () => {
			const plan = await service.create('Custom', 'client-id-1');
			assert.equal(plan.id, 'client-id-1');
		});

		it('lists every created plan', async () => {
			await service.create('A');
			await service.create('B');
			assert.equal(service.getAll().length, 2);
		});

		it('getById finds a plan by id, getById returns null for unknown', async () => {
			const plan = await service.create('Find me');
			assert.equal(service.getById(plan.id)!.title, 'Find me');
			assert.equal(service.getById('nonexistent'), null);
		});
	});

	describe('rename / remove', () => {
		it('renames a plan and bumps updatedAt', async () => {
			const plan = await service.create('Original');
			await new Promise((r) => setTimeout(r, 5));
			const renamed = await service.rename(plan.id, 'Renamed');
			assert.equal(renamed!.title, 'Renamed');
			assert.ok(renamed!.updatedAt >= plan.updatedAt);
		});

		it('returns null renaming an unknown plan', async () => {
			assert.equal(await service.rename('nonexistent', 'X'), null);
		});

		it('removes a plan and returns true; other plans are unaffected', async () => {
			const a = await service.create('A');
			const b = await service.create('B');
			assert.equal(await service.remove(a.id), true);
			assert.equal(service.getAll().length, 1);
			assert.equal(service.getAll()[0].id, b.id);
		});

		it('returns false removing an unknown plan', async () => {
			assert.equal(await service.remove('nonexistent'), false);
		});
	});

	describe('weeks/cards are scoped per plan (no cross-plan bleed)', () => {
		it('addWeek/removeWeek only affect the targeted plan', async () => {
			const planA = await service.create('A');
			const planB = await service.create('B');
			await service.addWeek(planA.id);
			assert.equal(service.getById(planA.id)!.weeks.length, 2);
			assert.equal(service.getById(planB.id)!.weeks.length, 1);
		});

		it('returns null for addWeek/setMeetingDays on an unknown plan', async () => {
			assert.equal(await service.addWeek('nonexistent'), null);
			assert.equal(await service.setMeetingDays('nonexistent', ['mon']), null);
		});

		it('addCard/updateCard/removeCard/moveCard only affect the targeted plan', async () => {
			const planA = await service.create('A');
			const planB = await service.create('B');
			const weekA = service.getById(planA.id)!.weeks[0].id;
			const card = await service.addCard(planA.id, weekA, { day: 'mon', durationHours: 1 });
			assert.ok(card);

			// The same card id must not be reachable through the other plan.
			assert.equal(service.getCard(planB.id, card!.id), null);
			assert.equal(await service.updateCard(planB.id, card!.id, { topics: 'x' }), null);
			assert.equal(await service.removeCard(planB.id, card!.id), false);

			const updated = await service.updateCard(planA.id, card!.id, { topics: 'Real update' });
			assert.equal(updated!.topics, 'Real update');
		});

		it('moveCard moves a card across weeks within its own plan', async () => {
			const plan = await service.create('A');
			const week1 = service.getById(plan.id)!.weeks[0].id;
			const plan2 = await service.addWeek(plan.id);
			const week2 = plan2!.weeks[1].id;
			const card = await service.addCard(plan.id, week1, { day: 'mon', durationHours: 1 });

			const moved = await service.moveCard(plan.id, card!.id, { weekId: week2, day: 'fri', beforeCardId: null });
			assert.equal(moved, true);

			const finalPlan = service.getById(plan.id)!;
			assert.deepEqual(finalPlan.weeks[0].days.mon, []);
			assert.equal(finalPlan.weeks[1].days.fri[0].id, card!.id);
		});
	});

	describe('replaceAll', () => {
		it('replaces the entire collection (used by CourseService.copy())', async () => {
			await service.create('Old');
			const fresh = [
				{
					id: 'x',
					title: 'Fresh',
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
					meetingDays: [] as const,
					weeks: []
				}
			];
			await service.replaceAll(fresh as any);
			assert.deepEqual(
				service.getAll().map((p) => p.title),
				['Fresh']
			);
		});
	});

	describe('persistence', () => {
		it('reloads plans from disk after flush', async () => {
			const plan = await service.create('Persisted');
			const weekId = plan.weeks[0].id;
			await service.addCard(plan.id, weekId, { day: 'wed', durationHours: 1.5, topics: 'Saved' });
			await service.flush();

			const service2 = new LecturePlansService(filePath);
			await service2.load();
			const reloaded = service2.getById(plan.id);
			assert.ok(reloaded);
			assert.equal(reloaded!.weeks[0].days.wed[0].topics, 'Saved');
			await service2.close();
		});
	});
});
