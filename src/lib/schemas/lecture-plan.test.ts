import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { DURATION_OPTIONS_HOURS, formatDurationHours, LecturePlanSchema, LecturePlansFileSchema } from './lecture-plan';

const base = { id: 'plan-1', title: 'Weekly Lecture Plan', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

describe('LecturePlanSchema', () => {
	it('parses a named plan with mixed populated/empty days', () => {
		const fixture = {
			...base,
			meetingDays: ['mon', 'wed', 'fri'],
			weeks: [
				{
					id: 'w1',
					days: {
						mon: [{ id: 'c1', durationHours: 1, topics: 'Intro' }],
						tue: [],
						wed: [{ id: 'c2', durationHours: 1.5, topics: '' }],
						thu: [],
						fri: []
					}
				}
			]
		};
		const parsed = LecturePlanSchema.parse(fixture);
		assert.equal(parsed.id, 'plan-1');
		assert.equal(parsed.title, 'Weekly Lecture Plan');
		assert.deepEqual(parsed.meetingDays, ['mon', 'wed', 'fri']);
		assert.equal(parsed.weeks[0].days.mon[0].topics, 'Intro');
		assert.deepEqual(parsed.weeks[0].days.tue, []);
	});

	it('backfills a missing topics field to "" (pre-existing on-disk shape)', () => {
		const fixture = {
			...base,
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: 2 }], tue: [], wed: [], thu: [], fri: [] } }]
		};
		const parsed = LecturePlanSchema.parse(fixture) as any;
		assert.equal(parsed.weeks[0].days.mon[0].topics, '');
	});

	it('defaults meetingDays and weeks to empty arrays when omitted', () => {
		const parsed = LecturePlanSchema.parse(base);
		assert.deepEqual(parsed.meetingDays, []);
		assert.deepEqual(parsed.weeks, []);
	});

	it('accepts a durationHours of 0 (the shortest dropdown option)', () => {
		const fixture = {
			...base,
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: 0 }], tue: [], wed: [], thu: [], fri: [] } }]
		};
		const parsed = LecturePlanSchema.parse(fixture) as any;
		assert.equal(parsed.weeks[0].days.mon[0].durationHours, 0);
	});

	it('rejects a negative durationHours', () => {
		const fixture = {
			...base,
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: -0.25 }], tue: [], wed: [], thu: [], fri: [] } }]
		};
		assert.throws(() => LecturePlanSchema.parse(fixture));
	});

	it('rejects a plan missing an id or title', () => {
		assert.throws(() => LecturePlanSchema.parse({ createdAt: base.createdAt, updatedAt: base.updatedAt }));
	});

	it('preserves unknown keys via passthrough', () => {
		const fixture = { ...base, meetingDays: [], weeks: [], futureField: 'from a later version' };
		const parsed = LecturePlanSchema.parse(fixture) as any;
		assert.equal(parsed.futureField, 'from a later version');
	});
});

describe('DURATION_OPTIONS_HOURS / formatDurationHours', () => {
	it('spans 0m to 2h in 15-minute increments', () => {
		assert.deepEqual(DURATION_OPTIONS_HOURS, [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
	});

	it('formats whole hours without a minutes component', () => {
		assert.equal(formatDurationHours(1), '1h');
		assert.equal(formatDurationHours(2), '2h');
	});

	it('formats sub-hour durations as minutes only', () => {
		assert.equal(formatDurationHours(0), '0m');
		assert.equal(formatDurationHours(0.25), '15m');
		assert.equal(formatDurationHours(0.75), '45m');
	});

	it('formats mixed hour+minute durations without a space (must fit a narrow dropdown)', () => {
		assert.equal(formatDurationHours(1.25), '1h15');
		assert.equal(formatDurationHours(1.75), '1h45');
	});
});

describe('LecturePlansFileSchema', () => {
	it('round-trips a full multi-plan file through JSON.stringify/parse', () => {
		const fixture = {
			lecturePlans: [
				{
					...base,
					meetingDays: ['tue', 'thu'],
					weeks: [
						{
							id: 'w1',
							days: {
								mon: [],
								tue: [{ id: 'c1', durationHours: 1, topics: 'Chapter 1' }],
								wed: [],
								thu: [{ id: 'c2', durationHours: 2, topics: '' }],
								fri: []
							}
						}
					]
				},
				{
					id: 'plan-2',
					title: 'Fall 2026 Schedule',
					createdAt: base.createdAt,
					updatedAt: base.updatedAt,
					meetingDays: [],
					weeks: []
				}
			]
		};
		const roundTripped = LecturePlansFileSchema.parse(JSON.parse(JSON.stringify(fixture)));
		assert.deepEqual(roundTripped, fixture);
	});

	it('defaults to an empty array when lecturePlans is omitted', () => {
		const parsed = LecturePlansFileSchema.parse({});
		assert.deepEqual(parsed.lecturePlans, []);
	});
});
