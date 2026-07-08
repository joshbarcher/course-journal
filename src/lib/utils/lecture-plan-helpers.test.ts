import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { containerKey, emptyDayCards, findCard, moveCard, parseContainerKey } from './lecture-plan-helpers';
import type { LecturePlan } from '$lib/schemas/lecture-plan';

function card(id: string, durationHours = 1) {
	return { id, durationHours, topics: '' };
}

function plan(weeks: LecturePlan['weeks']): LecturePlan {
	return {
		id: 'plan-1',
		title: 'Test Plan',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		meetingDays: [],
		weeks
	};
}

describe('emptyDayCards', () => {
	it('returns an object with all five weekdays as empty arrays', () => {
		assert.deepEqual(emptyDayCards(), { mon: [], tue: [], wed: [], thu: [], fri: [] });
	});
});

describe('findCard', () => {
	it('locates a card by id across weeks/days', () => {
		const p = plan([
			{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a')] } },
			{ id: 'w2', days: { ...emptyDayCards(), wed: [card('b')] } }
		]);
		assert.deepEqual(findCard(p, 'b'), { weekIdx: 1, day: 'wed', cardIdx: 0 });
	});

	it('returns null for an unknown card id', () => {
		const p = plan([{ id: 'w1', days: emptyDayCards() }]);
		assert.equal(findCard(p, 'nonexistent'), null);
	});
});

describe('moveCard', () => {
	it('reorders within the same day', () => {
		const p = plan([{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a'), card('b'), card('c')] } }]);
		const next = moveCard(p, 'a', { weekId: 'w1', day: 'mon', beforeCardId: 'c' });
		assert.deepEqual(
			next.weeks[0].days.mon.map((c) => c.id),
			['b', 'a', 'c']
		);
	});

	it('moves a card to a different day in the same week', () => {
		const p = plan([{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a')], wed: [card('b')] } }]);
		const next = moveCard(p, 'a', { weekId: 'w1', day: 'wed', beforeCardId: 'b' });
		assert.deepEqual(next.weeks[0].days.mon, []);
		assert.deepEqual(
			next.weeks[0].days.wed.map((c) => c.id),
			['a', 'b']
		);
	});

	it('moves a card to a different week entirely', () => {
		const p = plan([
			{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a')] } },
			{ id: 'w2', days: { ...emptyDayCards(), mon: [card('b')] } }
		]);
		const next = moveCard(p, 'a', { weekId: 'w2', day: 'mon', beforeCardId: null });
		assert.deepEqual(next.weeks[0].days.mon, []);
		assert.deepEqual(
			next.weeks[1].days.mon.map((c) => c.id),
			['b', 'a']
		);
	});

	it('appends to the end when beforeCardId is omitted/null', () => {
		const p = plan([{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a')], wed: [card('b'), card('c')] } }]);
		const next = moveCard(p, 'a', { weekId: 'w1', day: 'wed' });
		assert.deepEqual(
			next.weeks[0].days.wed.map((c) => c.id),
			['b', 'c', 'a']
		);
	});

	it('is a no-op (returns the same plan) for an unknown card id', () => {
		const p = plan([{ id: 'w1', days: emptyDayCards() }]);
		const next = moveCard(p, 'nonexistent', { weekId: 'w1', day: 'mon' });
		assert.equal(next, p);
	});

	it('is a no-op for an unknown target week id', () => {
		const p = plan([{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a')] } }]);
		const next = moveCard(p, 'a', { weekId: 'nonexistent', day: 'mon' });
		assert.equal(next, p);
	});

	it('does not mutate the original plan', () => {
		const p = plan([{ id: 'w1', days: { ...emptyDayCards(), mon: [card('a')], wed: [card('b')] } }]);
		moveCard(p, 'a', { weekId: 'w1', day: 'wed' });
		assert.deepEqual(
			p.weeks[0].days.mon.map((c) => c.id),
			['a']
		);
	});
});

describe('containerKey / parseContainerKey', () => {
	it('round-trips a weekId/day pair', () => {
		const key = containerKey('week-123', 'thu');
		assert.deepEqual(parseContainerKey(key), { weekId: 'week-123', day: 'thu' });
	});

	it('returns null for a plain card id (not a container key)', () => {
		assert.equal(parseContainerKey('some-card-id'), null);
	});
});
