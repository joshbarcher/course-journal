import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { LecturePlanService } from './lecture-plan-service';

function tmpPath() {
	return path.join(os.tmpdir(), `lecture-plan-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

async function cleanup(filePath: string) {
	await fsp.unlink(filePath).catch(() => {});
	await fsp.unlink(filePath + '.checkpoint.json').catch(() => {});
}

describe('LecturePlanService', () => {
	let service: LecturePlanService;
	let filePath: string;

	beforeEach(async () => {
		filePath = tmpPath();
		service = new LecturePlanService(filePath);
		await service.load();
	});

	afterEach(async () => {
		await service.close();
		await cleanup(filePath);
	});

	describe('initial state', () => {
		it('seeds one empty week and no meeting days', () => {
			const plan = service.getPlan();
			assert.deepEqual(plan.meetingDays, []);
			assert.equal(plan.weeks.length, 1);
			assert.deepEqual(plan.weeks[0].days, { mon: [], tue: [], wed: [], thu: [], fri: [] });
		});
	});

	describe('setMeetingDays', () => {
		it('stores the given weekdays in canonical order regardless of input order', async () => {
			const plan = await service.setMeetingDays(['fri', 'mon', 'wed']);
			assert.deepEqual(plan.meetingDays, ['mon', 'wed', 'fri']);
		});
	});

	describe('addWeek / removeWeek', () => {
		it('appends a new empty week', async () => {
			const plan = await service.addWeek();
			assert.equal(plan.weeks.length, 2);
		});

		it('uses a client-provided id when given one (supports optimistic UI adds)', async () => {
			const plan = await service.addWeek('client-generated-id');
			assert.equal(plan.weeks[1].id, 'client-generated-id');
		});

		it('removes a week by id', async () => {
			const afterAdd = await service.addWeek();
			const secondWeekId = afterAdd.weeks[1].id;
			const afterRemove = await service.removeWeek(secondWeekId);
			assert.equal(afterRemove!.weeks.length, 1);
		});

		it('returns null when removing an unknown week id', async () => {
			assert.equal(await service.removeWeek('nonexistent'), null);
		});
	});

	describe('addCard / updateCard / removeCard', () => {
		it('adds a card to the given week/day', async () => {
			const weekId = service.getPlan().weeks[0].id;
			const card = await service.addCard(weekId, { day: 'mon', durationHours: 1.5, topics: 'Intro' });
			assert.ok(card);
			assert.equal(card!.durationHours, 1.5);
			assert.equal(service.getPlan().weeks[0].days.mon.length, 1);
		});

		it('returns null when adding to an unknown week id', async () => {
			const card = await service.addCard('nonexistent', { day: 'mon', durationHours: 1 });
			assert.equal(card, null);
		});

		it('updates a card by id regardless of which day it lives in', async () => {
			const weekId = service.getPlan().weeks[0].id;
			const card = await service.addCard(weekId, { day: 'tue', durationHours: 1 });
			const updated = await service.updateCard(card!.id, { topics: 'New topic' });
			assert.equal(updated!.topics, 'New topic');
		});

		it('ignores an id key in the patch', async () => {
			const weekId = service.getPlan().weeks[0].id;
			const card = await service.addCard(weekId, { day: 'tue', durationHours: 1 });
			const updated = await service.updateCard(card!.id, { id: 'hacked', topics: 'X' });
			assert.equal(updated!.id, card!.id);
		});

		it('removes a card by id', async () => {
			const weekId = service.getPlan().weeks[0].id;
			const card = await service.addCard(weekId, { day: 'wed', durationHours: 1 });
			const removed = await service.removeCard(card!.id);
			assert.equal(removed, true);
			assert.equal(service.getPlan().weeks[0].days.wed.length, 0);
		});
	});

	describe('moveCard', () => {
		it('moves a card across weeks and persists the new location', async () => {
			const weekId1 = service.getPlan().weeks[0].id;
			const plan2 = await service.addWeek();
			const weekId2 = plan2.weeks[1].id;
			const card = await service.addCard(weekId1, { day: 'mon', durationHours: 1 });

			const moved = await service.moveCard(card!.id, { weekId: weekId2, day: 'fri', beforeCardId: null });
			assert.equal(moved, true);

			const plan = service.getPlan();
			assert.deepEqual(plan.weeks[0].days.mon, []);
			assert.equal(plan.weeks[1].days.fri[0].id, card!.id);
		});

		it('returns false for an unknown card id', async () => {
			const weekId = service.getPlan().weeks[0].id;
			assert.equal(await service.moveCard('nonexistent', { weekId, day: 'mon' }), false);
		});
	});

	describe('persistence', () => {
		it('reloads the plan from disk after flush', async () => {
			const weekId = service.getPlan().weeks[0].id;
			const card = await service.addCard(weekId, { day: 'thu', durationHours: 2, topics: 'Persisted' });
			await service.flush();

			const service2 = new LecturePlanService(filePath);
			await service2.load();
			const found = service2.getCard(card!.id);
			assert.ok(found);
			assert.equal(found!.card.topics, 'Persisted');
			await service2.close();
		});
	});
});
