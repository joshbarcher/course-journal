import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { DURATION_OPTIONS_HOURS, formatDurationHours, LecturePlanFileSchema, LecturePlanSchema } from './lecture-plan';

describe('LecturePlanSchema', () => {
	it('parses a plan with mixed populated/empty days', () => {
		const fixture = {
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
		assert.deepEqual(parsed.meetingDays, ['mon', 'wed', 'fri']);
		assert.equal(parsed.weeks[0].days.mon[0].topics, 'Intro');
		assert.deepEqual(parsed.weeks[0].days.tue, []);
	});

	it('backfills a missing topics field to "" (pre-existing on-disk shape)', () => {
		const fixture = {
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: 2 }], tue: [], wed: [], thu: [], fri: [] } }]
		};
		const parsed = LecturePlanSchema.parse(fixture) as any;
		assert.equal(parsed.weeks[0].days.mon[0].topics, '');
	});

	it('defaults meetingDays and weeks to empty arrays when omitted', () => {
		const parsed = LecturePlanSchema.parse({});
		assert.deepEqual(parsed.meetingDays, []);
		assert.deepEqual(parsed.weeks, []);
	});

	it('accepts a durationHours of 0 (the shortest dropdown option)', () => {
		const fixture = {
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: 0 }], tue: [], wed: [], thu: [], fri: [] } }]
		};
		const parsed = LecturePlanSchema.parse(fixture) as any;
		assert.equal(parsed.weeks[0].days.mon[0].durationHours, 0);
	});

	it('rejects a negative durationHours', () => {
		const fixture = {
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: -0.25 }], tue: [], wed: [], thu: [], fri: [] } }]
		};
		assert.throws(() => LecturePlanSchema.parse(fixture));
	});

	it('preserves unknown keys via passthrough', () => {
		const fixture = { meetingDays: [], weeks: [], futureField: 'from a later version' };
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

describe('LecturePlanFileSchema', () => {
	it('round-trips a full file through JSON.stringify/parse', () => {
		const fixture = {
			lecturePlan: {
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
			}
		};
		const roundTripped = LecturePlanFileSchema.parse(JSON.parse(JSON.stringify(fixture)));
		assert.deepEqual(roundTripped, fixture);
	});
});
