// Adversarial tests (new) for the request-body schemas that guard every
// mutating +server.ts handler. These are the app's first line of input
// validation, so the focus is on what must be REJECTED: missing/blank/
// wrong-type fields, unknown page types, negative durations, and attempts to
// patch immutable keys.
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
	CreateCourseBodySchema,
	CreatePageBodySchema,
	UpdatePageBodySchema,
	ReorderBodySchema,
	CreateLectureCardBodySchema,
	UpdateLectureCardBodySchema,
	MoveLectureCardBodySchema,
	LecturePlanPatternBodySchema
} from './api';

describe('CreateCourseBodySchema', () => {
	it('accepts a valid title', () => {
		assert.equal(CreateCourseBodySchema.safeParse({ title: 'Math' }).success, true);
	});
	it('rejects a missing title', () => {
		assert.equal(CreateCourseBodySchema.safeParse({}).success, false);
	});
	it('rejects an empty title', () => {
		const r = CreateCourseBodySchema.safeParse({ title: '' });
		assert.equal(r.success, false);
		assert.match(r.error!.issues[0].message, /title is required/);
	});
	it('rejects a non-string title', () => {
		assert.equal(CreateCourseBodySchema.safeParse({ title: 42 }).success, false);
		assert.equal(CreateCourseBodySchema.safeParse({ title: null }).success, false);
	});
	it('keeps unknown keys (looseObject) rather than rejecting them', () => {
		const r = CreateCourseBodySchema.safeParse({ title: 'X', extra: 1 });
		assert.equal(r.success, true);
	});
});

describe('CreatePageBodySchema', () => {
	it('accepts each of the five known page types', () => {
		for (const type of ['list', 'progress', 'progress-bars', 'notes', 'page']) {
			assert.equal(CreatePageBodySchema.safeParse({ type, title: 'T' }).success, true, type);
		}
	});
	it('rejects an unknown page type with a helpful message', () => {
		const r = CreatePageBodySchema.safeParse({ type: 'kanban', title: 'T' });
		assert.equal(r.success, false);
		assert.match(r.error!.issues.map((i) => i.message).join(' '), /type must be one of/);
	});
	it('rejects a missing type', () => {
		assert.equal(CreatePageBodySchema.safeParse({ title: 'T' }).success, false);
	});
	it('rejects a missing/blank title even with a valid type', () => {
		assert.equal(CreatePageBodySchema.safeParse({ type: 'notes' }).success, false);
		assert.equal(CreatePageBodySchema.safeParse({ type: 'notes', title: '' }).success, false);
	});
});

describe('UpdatePageBodySchema', () => {
	it('accepts an arbitrary partial patch of mutable fields', () => {
		assert.equal(UpdatePageBodySchema.safeParse({ title: 'New', notes: 'hi' }).success, true);
	});
	it('accepts an empty patch object', () => {
		assert.equal(UpdatePageBodySchema.safeParse({}).success, true);
	});
	it('rejects any patch that tries to change id', () => {
		assert.equal(UpdatePageBodySchema.safeParse({ id: 'x' }).success, false);
	});
	it('rejects any patch that tries to change type', () => {
		assert.equal(UpdatePageBodySchema.safeParse({ type: 'list' }).success, false);
	});
	it('rejects any patch that tries to change createdAt', () => {
		assert.equal(UpdatePageBodySchema.safeParse({ createdAt: '1970' }).success, false);
	});
	it('rejects an immutable key even when mixed with legitimate fields', () => {
		assert.equal(UpdatePageBodySchema.safeParse({ title: 'ok', type: 'list' }).success, false);
	});
});

describe('ReorderBodySchema', () => {
	it('accepts an array of string ids', () => {
		assert.equal(ReorderBodySchema.safeParse({ ids: ['a', 'b'] }).success, true);
	});
	it('accepts an empty ids array', () => {
		assert.equal(ReorderBodySchema.safeParse({ ids: [] }).success, true);
	});
	it('rejects ids that is not an array', () => {
		assert.equal(ReorderBodySchema.safeParse({ ids: 'a' }).success, false);
	});
	it('rejects non-string elements inside ids', () => {
		assert.equal(ReorderBodySchema.safeParse({ ids: ['a', 5] }).success, false);
	});
	it('rejects a missing ids field', () => {
		assert.equal(ReorderBodySchema.safeParse({}).success, false);
	});
});

describe('CreateLectureCardBodySchema', () => {
	it('accepts a valid card body', () => {
		assert.equal(
			CreateLectureCardBodySchema.safeParse({ day: 'mon', durationHours: 1.5 }).success,
			true
		);
	});
	it('rejects a negative durationHours', () => {
		const r = CreateLectureCardBodySchema.safeParse({ day: 'mon', durationHours: -1 });
		assert.equal(r.success, false);
		assert.match(r.error!.issues.map((i) => i.message).join(' '), /durationHours must be 0 or greater/);
	});
	it('accepts a zero durationHours (boundary)', () => {
		assert.equal(CreateLectureCardBodySchema.safeParse({ day: 'mon', durationHours: 0 }).success, true);
	});
	it('rejects a weekend day (only mon–fri are valid)', () => {
		assert.equal(CreateLectureCardBodySchema.safeParse({ day: 'sat', durationHours: 1 }).success, false);
		assert.equal(CreateLectureCardBodySchema.safeParse({ day: 'sun', durationHours: 1 }).success, false);
	});
	it('rejects a missing day', () => {
		assert.equal(CreateLectureCardBodySchema.safeParse({ durationHours: 1 }).success, false);
	});
	it('rejects a non-numeric durationHours', () => {
		assert.equal(CreateLectureCardBodySchema.safeParse({ day: 'mon', durationHours: '1' }).success, false);
	});
});

describe('UpdateLectureCardBodySchema', () => {
	it('accepts a patch of duration/topics', () => {
		assert.equal(UpdateLectureCardBodySchema.safeParse({ durationHours: 2, topics: 'x' }).success, true);
	});
	it('rejects a patch that tries to change the card id', () => {
		assert.equal(UpdateLectureCardBodySchema.safeParse({ id: 'x' }).success, false);
	});
});

describe('MoveLectureCardBodySchema', () => {
	it('accepts a null targetCardId (append) and an omitted one', () => {
		assert.equal(
			MoveLectureCardBodySchema.safeParse({ targetWeekId: 'w', targetDay: 'mon', targetCardId: null }).success,
			true
		);
		assert.equal(MoveLectureCardBodySchema.safeParse({ targetWeekId: 'w', targetDay: 'mon' }).success, true);
	});
	it('rejects a missing targetWeekId', () => {
		assert.equal(MoveLectureCardBodySchema.safeParse({ targetDay: 'mon' }).success, false);
	});
	it('rejects an invalid targetDay', () => {
		assert.equal(MoveLectureCardBodySchema.safeParse({ targetWeekId: 'w', targetDay: 'someday' }).success, false);
	});
});

describe('LecturePlanPatternBodySchema', () => {
	it('accepts a list of valid weekdays', () => {
		assert.equal(LecturePlanPatternBodySchema.safeParse({ days: ['mon', 'fri'] }).success, true);
	});
	it('rejects a list containing an invalid weekday', () => {
		assert.equal(LecturePlanPatternBodySchema.safeParse({ days: ['mon', 'sat'] }).success, false);
	});
	it('rejects days that is not an array', () => {
		assert.equal(LecturePlanPatternBodySchema.safeParse({ days: 'mon' }).success, false);
	});
});
