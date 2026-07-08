// Ported from src/tests/courseService.test.js — minimal-churn port: only
// the node:test -> vitest import swap, assertion bodies unchanged.
import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { CourseService } from './course-service';

function tmpDir() {
	return path.join(os.tmpdir(), `course-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function cleanupDir(dir: string) {
	await fsp.rm(dir, { recursive: true, force: true });
}

describe('CourseService', () => {
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

	describe('initial state', () => {
		it('starts with no courses', () => {
			assert.deepEqual(service.getAll(), []);
		});
	});

	describe('create', () => {
		it('returns a course with generated id', async () => {
			const course = await service.create({ title: 'Math 101' });
			assert.ok(course.id);
			assert.equal(typeof course.id, 'string');
		});

		it('sets title and timestamps', async () => {
			const course = await service.create({ title: 'Physics' });
			assert.equal(course.title, 'Physics');
			assert.ok(new Date(course.createdAt).getTime());
			assert.ok(new Date(course.updatedAt).getTime());
		});

		it('adds course to getAll()', async () => {
			await service.create({ title: 'A' });
			await service.create({ title: 'B' });
			assert.equal(service.getAll().length, 2);
		});

		it('creates a journal for the new course', async () => {
			const course = await service.create({ title: 'Chemistry' });
			const journal = service.getJournal(course.id);
			assert.ok(journal);
			assert.deepEqual(journal.getAll(), []);
		});
	});

	describe('getById', () => {
		it('returns course by id', async () => {
			const created = await service.create({ title: 'History' });
			const found = service.getById(created.id);
			assert.equal(found!.title, 'History');
		});

		it('returns null for unknown id', () => {
			assert.equal(service.getById('nope'), null);
		});
	});

	describe('update', () => {
		it('renames a course', async () => {
			const course = await service.create({ title: 'Old' });
			const updated = await service.update(course.id, { title: 'New' });
			assert.equal(updated!.title, 'New');
		});

		it('preserves id and createdAt', async () => {
			const course = await service.create({ title: 'X' });
			const updated = await service.update(course.id, { id: 'hacked', title: 'Y', createdAt: '1970' });
			assert.equal(updated!.id, course.id);
			assert.equal(updated!.createdAt, course.createdAt);
		});

		it('returns null for unknown id', async () => {
			const result = await service.update('nope', { title: 'Y' });
			assert.equal(result, null);
		});
	});

	describe('remove', () => {
		it('removes a course and returns true', async () => {
			const course = await service.create({ title: 'Delete me' });
			const result = await service.remove(course.id);
			assert.equal(result, true);
			assert.equal(service.getById(course.id), null);
		});

		it('returns false for unknown id', async () => {
			assert.equal(await service.remove('nope'), false);
		});

		it('cleans up the journal from memory', async () => {
			const course = await service.create({ title: 'Temp' });
			await service.remove(course.id);
			assert.throws(() => service.getJournal(course.id), /No journal/);
		});
	});

	describe('copy', () => {
		it('returns null for unknown source', async () => {
			const result = await service.copy('nope');
			assert.equal(result, null);
		});

		it('creates a new course with "(Copy)" suffix', async () => {
			const source = await service.create({ title: 'Algebra' });
			const copy = await service.copy(source.id);
			assert.equal(copy!.title, 'Algebra (Copy)');
			assert.notEqual(copy!.id, source.id);
		});

		it('copies pages from source into new course', async () => {
			const source = await service.create({ title: 'Bio' });
			const journal = service.getJournal(source.id);
			await journal.create({ type: 'notes', title: 'Week 1' });
			await journal.create({ type: 'list', title: 'Topics' });

			const copy = await service.copy(source.id);
			const copyJournal = service.getJournal(copy!.id);
			const copyPages = copyJournal.getAll();
			assert.equal(copyPages.length, 2);
			assert.equal(copyPages[0].title, 'Week 1');
			assert.equal(copyPages[1].title, 'Topics');
		});

		it('assigns new IDs to copied pages', async () => {
			const source = await service.create({ title: 'CS' });
			const journal = service.getJournal(source.id);
			const origPage = await journal.create({ type: 'notes', title: 'Notes' });

			const copy = await service.copy(source.id);
			const copyPages = service.getJournal(copy!.id).getAll();
			assert.notEqual(copyPages[0].id, origPage.id);
		});

		it('resets progress task states to null', async () => {
			const source = await service.create({ title: 'Stats' });
			const journal = service.getJournal(source.id);
			await journal.create({
				type: 'progress',
				title: 'Slides',
				tasks: [{ id: 't1', title: 'Slide 1', state: 'done' }]
			});

			const copy = await service.copy(source.id);
			const copyPages = service.getJournal(copy!.id).getAll();
			assert.equal((copyPages[0] as any).tasks[0].state, null);
		});

		it('resets progress-bars step states to null', async () => {
			const source = await service.create({ title: 'Calc' });
			const journal = service.getJournal(source.id);
			await journal.create({
				type: 'progress-bars',
				title: 'Modules',
				bars: [{ id: 'b1', title: 'Mod 1', steps: [{ id: 's1', title: 'Step', state: 'working' }] }]
			});

			const copy = await service.copy(source.id);
			const copyPages = service.getJournal(copy!.id).getAll();
			assert.equal((copyPages[0] as any).bars[0].steps[0].state, null);
		});

		it('resets notes to empty array', async () => {
			const source = await service.create({ title: 'Eng' });
			const journal = service.getJournal(source.id);
			await journal.create({
				type: 'notes',
				title: 'My Notes',
				notes: [{ id: 'n1', text: 'Hello', createdAt: '' }]
			});

			const copy = await service.copy(source.id);
			const copyPages = service.getJournal(copy!.id).getAll();
			assert.deepEqual((copyPages[0] as any).notes, []);
		});

		it('preserves page content in rich text pages', async () => {
			const source = await service.create({ title: 'Lit' });
			const journal = service.getJournal(source.id);
			await journal.create({ type: 'page', title: 'Lecture 1', content: '<p>Hello</p>' });

			const copy = await service.copy(source.id);
			const copyPages = service.getJournal(copy!.id).getAll();
			assert.equal((copyPages[0] as any).content, '<p>Hello</p>');
		});
	});

	describe('legacy lecture plan migration', () => {
		it('migrates an existing singleton file into one named plan on first load, and renames (not deletes) the legacy file', async () => {
			const course = await service.create({ title: 'Legacy Course' });
			await service.flush();
			await service.close();

			// Simulate a pre-existing production lecture-plan.json from
			// before named/multi-instance plans existed.
			const legacyPath = path.join(baseDir, 'courses', `${course.id}.lecture-plan.json`);
			await fsp.mkdir(path.dirname(legacyPath), { recursive: true });
			const legacyData = {
				lecturePlan: {
					meetingDays: ['mon', 'wed'],
					weeks: [
						{
							id: 'week-1',
							days: {
								mon: [{ id: 'card-1', durationHours: 1.5, topics: 'Intro' }],
								tue: [],
								wed: [],
								thu: [],
								fri: []
							}
						}
					]
				}
			};
			await fsp.writeFile(legacyPath, JSON.stringify(legacyData, null, 4));

			const service2 = new CourseService(baseDir);
			await service2.load();
			try {
				const plans = service2.getLecturePlans(course.id).getAll();
				assert.equal(plans.length, 1);
				assert.equal(plans[0].title, 'Weekly Lecture Plan');
				assert.deepEqual(plans[0].meetingDays, ['mon', 'wed']);
				assert.equal(plans[0].weeks[0].days.mon[0].topics, 'Intro');

				// Legacy file is renamed, not deleted or left in place — a real
				// file must exist at the original path or `.access` throws.
				await assert.rejects(fsp.access(legacyPath));
				await fsp.access(legacyPath + '.migrated');
			} finally {
				await service2.close();
			}
		});

		it('does not re-migrate or resurrect a deleted planner on a later load', async () => {
			const course = await service.create({ title: 'Course' });
			await service.flush();
			await service.close();

			const legacyPath = path.join(baseDir, 'courses', `${course.id}.lecture-plan.json`);
			await fsp.mkdir(path.dirname(legacyPath), { recursive: true });
			await fsp.writeFile(legacyPath, JSON.stringify({ lecturePlan: { meetingDays: [], weeks: [] } }));

			const service2 = new CourseService(baseDir);
			await service2.load();
			const migrated = service2.getLecturePlans(course.id).getAll()[0];
			await service2.getLecturePlans(course.id).remove(migrated.id); // user deletes their only planner
			await service2.flush();
			await service2.close();

			const service3 = new CourseService(baseDir);
			await service3.load();
			try {
				assert.deepEqual(service3.getLecturePlans(course.id).getAll(), []);
			} finally {
				await service3.close();
			}
		});
	});
});
