// Adversarial tests (new, not a port) — hunt for real bugs in
// LecturePlansService: move-to-nowhere no-ops, meeting-day normalization,
// card mutation immutability, and unknown-target return contracts. Same
// temp-file convention as lecture-plans-service.test.ts.
import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { LecturePlansService } from './lecture-plans-service';

function tmpPath() {
	return path.join(os.tmpdir(), `lp-adv-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

async function cleanup(filePath: string) {
	await fsp.unlink(filePath).catch(() => {});
	await fsp.unlink(filePath + '.checkpoint.json').catch(() => {});
}

describe('LecturePlansService (adversarial)', () => {
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

	describe('moveCard target validation', () => {
		it('returns false when the target week does not exist (no silent 200)', async () => {
			const plan = await service.create('P');
			const wk = plan.weeks[0];
			const card = await service.addCard(plan.id, wk.id, { day: 'mon', durationHours: 1 });
			const moved = await service.moveCard(plan.id, card!.id, {
				weekId: 'does-not-exist',
				day: 'tue',
				beforeCardId: null
			});
			// Regression guard for the move-to-nowhere bug.
			assert.equal(moved, false);
			// And the card must stay exactly where it was.
			assert.equal(service.getCard(plan.id, card!.id)!.day, 'mon');
		});

		it('returns false for an unknown card', async () => {
			const plan = await service.create('P');
			const moved = await service.moveCard(plan.id, 'ghost', {
				weekId: plan.weeks[0].id,
				day: 'mon',
				beforeCardId: null
			});
			assert.equal(moved, false);
		});

		it('returns false for an unknown plan', async () => {
			const moved = await service.moveCard('ghost-plan', 'ghost-card', {
				weekId: 'w',
				day: 'mon',
				beforeCardId: null
			});
			assert.equal(moved, false);
		});

		it('still succeeds and actually moves the card for a valid target', async () => {
			const plan = await service.create('P');
			const wk1 = plan.weeks[0];
			const plan2 = await service.addWeek(plan.id);
			const wk2 = plan2!.weeks[1];
			const card = await service.addCard(plan.id, wk1.id, { day: 'mon', durationHours: 1 });
			const moved = await service.moveCard(plan.id, card!.id, {
				weekId: wk2.id,
				day: 'fri',
				beforeCardId: null
			});
			assert.equal(moved, true);
			const loc = service.getCard(plan.id, card!.id)!;
			assert.equal(loc.weekId, wk2.id);
			assert.equal(loc.day, 'fri');
		});
	});

	describe('setMeetingDays normalization', () => {
		it('dedupes and re-sorts into canonical weekday order', async () => {
			const plan = await service.create('P');
			const updated = await service.setMeetingDays(plan.id, ['fri', 'mon', 'mon', 'wed']);
			assert.deepEqual(updated!.meetingDays, ['mon', 'wed', 'fri']);
		});

		it('an empty pattern clears meeting days', async () => {
			const plan = await service.create('P');
			await service.setMeetingDays(plan.id, ['mon', 'tue']);
			const cleared = await service.setMeetingDays(plan.id, []);
			assert.deepEqual(cleared!.meetingDays, []);
		});
	});

	describe('card mutation contracts', () => {
		it('updateCard cannot change a card id even if the patch carries one', async () => {
			const plan = await service.create('P');
			const card = await service.addCard(plan.id, plan.weeks[0].id, { day: 'mon', durationHours: 1 });
			const updated = await service.updateCard(plan.id, card!.id, { id: 'hacked', durationHours: 2 });
			assert.equal(updated!.id, card!.id);
			assert.equal(updated!.durationHours, 2);
		});

		it('addCard to an unknown week returns null and adds nothing', async () => {
			const plan = await service.create('P');
			const card = await service.addCard(plan.id, 'no-such-week', { day: 'mon', durationHours: 1 });
			assert.equal(card, null);
			assert.deepEqual(service.getById(plan.id)!.weeks[0].days.mon, []);
		});

		it('removeCard returns false for a card that is not there', async () => {
			const plan = await service.create('P');
			assert.equal(await service.removeCard(plan.id, 'ghost'), false);
		});

		it('removeWeek returns null for a week id from a different plan', async () => {
			const p1 = await service.create('P1');
			const p2 = await service.create('P2');
			const foreignWeekId = p2.weeks[0].id;
			assert.equal(await service.removeWeek(p1.id, foreignWeekId), null);
			// p1's own week is untouched.
			assert.equal(service.getById(p1.id)!.weeks.length, 1);
		});
	});

	describe('unicode / long topics round-trip', () => {
		it('preserves emoji + very long topics through flush/reload', async () => {
			const plan = await service.create('P');
			const topics = '🧪 химия ' + 'z'.repeat(10_000);
			const card = await service.addCard(plan.id, plan.weeks[0].id, {
				day: 'mon',
				durationHours: 1.75,
				topics
			});
			await service.flush();
			const reloaded = new LecturePlansService(filePath);
			await reloaded.load();
			assert.equal(reloaded.getCard(plan.id, card!.id)!.card.topics, topics);
			await reloaded.close();
		});
	});
});
