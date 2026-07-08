// Ported from src/services/courseService.js — manages courses.json plus one
// JournalService per course (lazily created/loaded, cached in a Map).
import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../../../../logger.js';
import { ManagedFile, type LogLevel } from './managed-file';
import { CoursesFileSchema, type Course, type CoursesFile } from '$lib/schemas/course';
import { JournalService } from './journal-service';
import { LecturePlansService } from './lecture-plans-service';
import type { Page } from '$lib/schemas/page';
import { LegacyLecturePlanFileSchema, type LecturePlan, type LectureWeek } from '$lib/schemas/lecture-plan';
import { getEnv } from '../env';

function now(): string {
	return new Date().toISOString();
}

function log(level: LogLevel, msg: string, meta?: unknown) {
	(logger as unknown as Record<string, (msg: string, meta?: unknown) => void>)[level]?.(msg, meta);
}

function resetPageState(page: Partial<Page> & Record<string, unknown>): Record<string, unknown> {
	if (page.type === 'progress') {
		const tasks = (page as { tasks?: unknown[] }).tasks ?? [];
		return { ...page, tasks: tasks.map((t) => ({ ...(t as object), state: null })), notes: '' };
	}
	if (page.type === 'progress-bars') {
		const bars = (page as { bars?: { steps?: unknown[] }[] }).bars ?? [];
		return {
			...page,
			bars: bars.map((b) => ({
				...b,
				steps: (b.steps ?? []).map((s) => ({ ...(s as object), state: null }))
			})),
			notes: ''
		};
	}
	if (page.type === 'notes') {
		return { ...page, notes: [] };
	}
	if (page.type === 'list') {
		const items = (page as { items?: unknown[] }).items ?? [];
		return { ...page, items: items.map((i) => ({ ...(i as object), done: false })) };
	}
	return page;
}

export class CourseService {
	private _baseDir: string;
	private _coursesDir: string;
	private _mf: ManagedFile<CoursesFile>;
	private _journals: Map<string, JournalService>;
	private _lecturePlansServices: Map<string, LecturePlansService>;

	constructor(baseDir: string) {
		this._baseDir = baseDir;
		this._coursesDir = path.join(baseDir, 'courses');
		this._mf = new ManagedFile<CoursesFile>({
			filePath: path.join(baseDir, 'courses.json'),
			name: 'courses',
			defaultValue: () => ({ courses: [] }),
			parse: (str) => CoursesFileSchema.parse(JSON.parse(str)),
			maxFlushIntervalMs: 30_000,
			log
		});
		this._journals = new Map();
		this._lecturePlansServices = new Map();
	}

	private _journalPath(courseId: string): string {
		return path.join(this._coursesDir, `${courseId}.json`);
	}

	private _lecturePlansPath(courseId: string): string {
		return path.join(this._coursesDir, `${courseId}.lecture-plans.json`);
	}

	// Pre-migration singleton file — see _migrateLegacyLecturePlan.
	private _legacyLecturePlanPath(courseId: string): string {
		return path.join(this._coursesDir, `${courseId}.lecture-plan.json`);
	}

	async load(): Promise<void> {
		await this._mf.load();
		for (const course of this._mf.get().courses) {
			await this._ensureJournal(course.id);
			await this._ensureLecturePlans(course.id);
		}
	}

	async flush(): Promise<void> {
		await this._mf.flush();
		for (const js of this._journals.values()) {
			await js.flush();
		}
		for (const lp of this._lecturePlansServices.values()) {
			await lp.flush();
		}
	}

	async close(): Promise<void> {
		await this._mf.close();
		for (const js of this._journals.values()) {
			await js.close();
		}
		for (const lp of this._lecturePlansServices.values()) {
			await lp.close();
		}
	}

	private async _ensureJournal(courseId: string): Promise<JournalService> {
		if (!this._journals.has(courseId)) {
			const js = new JournalService(this._journalPath(courseId));
			await js.load();
			this._journals.set(courseId, js);
		}
		return this._journals.get(courseId)!;
	}

	private async _ensureLecturePlans(courseId: string): Promise<LecturePlansService> {
		if (!this._lecturePlansServices.has(courseId)) {
			const lp = new LecturePlansService(this._lecturePlansPath(courseId));
			await lp.load();
			// One-time migration: only attempted when the new plural file is
			// still empty, i.e. it was just created fresh by ManagedFile's
			// defaultValue rather than loaded from real content. Guards
			// against re-migrating (and resurrecting a deleted plan) on a
			// later restart by renaming the legacy file the moment it's
			// consumed — see _migrateLegacyLecturePlan.
			if (lp.getAll().length === 0) {
				const migrated = await this._migrateLegacyLecturePlan(courseId);
				if (migrated) await lp.replaceAll([migrated]);
			}
			this._lecturePlansServices.set(courseId, lp);
		}
		return this._lecturePlansServices.get(courseId)!;
	}

	// Reads a pre-migration singleton `<courseId>.lecture-plan.json` (if one
	// exists) and wraps its data into a single named LecturePlan. Renames
	// the legacy file (+ checkpoint) to `.migrated` on success — never
	// deleted, so the original bytes stay recoverable, but also never read
	// again, so this can't fire twice for the same course.
	private async _migrateLegacyLecturePlan(courseId: string): Promise<LecturePlan | null> {
		const legacyPath = this._legacyLecturePlanPath(courseId);
		let raw: string;
		try {
			raw = await fsp.readFile(legacyPath, 'utf8');
		} catch {
			return null;
		}
		let parsed: ReturnType<typeof LegacyLecturePlanFileSchema.parse>;
		try {
			parsed = LegacyLecturePlanFileSchema.parse(JSON.parse(raw));
		} catch (err) {
			log('warn', `Failed to parse legacy lecture plan for course ${courseId}, skipping migration`, err);
			return null;
		}
		const migrated: LecturePlan = {
			id: randomUUID(),
			title: 'Weekly Lecture Plan',
			createdAt: now(),
			updatedAt: now(),
			meetingDays: parsed.lecturePlan.meetingDays,
			weeks: parsed.lecturePlan.weeks
		};
		await fsp.rename(legacyPath, legacyPath + '.migrated').catch(() => {});
		await fsp.rename(legacyPath + '.checkpoint.json', legacyPath + '.checkpoint.json.migrated').catch(() => {});
		return migrated;
	}

	getJournal(courseId: string): JournalService {
		const js = this._journals.get(courseId);
		if (!js) throw new Error(`No journal for course ${courseId}`);
		return js;
	}

	getLecturePlans(courseId: string): LecturePlansService {
		const lp = this._lecturePlansServices.get(courseId);
		if (!lp) throw new Error(`No lecture plans for course ${courseId}`);
		return lp;
	}

	getAll(): Course[] {
		return [...this._mf.get().courses];
	}

	getById(id: string): Course | null {
		const c = this._mf.get().courses.find((c) => c.id === id);
		return c ? { ...c } : null;
	}

	async create(data: { title: string }): Promise<Course> {
		const course: Course = {
			id: randomUUID(),
			title: data.title,
			createdAt: now(),
			updatedAt: now()
		};
		const current = this._mf.get();
		await this._mf.set({ courses: [...current.courses, course] });
		await this._ensureJournal(course.id);
		await this._ensureLecturePlans(course.id);
		return course;
	}

	async update(id: string, updates: Record<string, unknown>): Promise<Course | null> {
		const current = this._mf.get();
		const idx = current.courses.findIndex((c) => c.id === id);
		if (idx === -1) return null;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _id, createdAt: _c, ...safe } = updates;
		const updated = { ...current.courses[idx], ...safe, updatedAt: now() } as Course;
		const courses = [...current.courses];
		courses[idx] = updated;
		await this._mf.set({ courses });
		return updated;
	}

	// Deliberate deviation from a strict 1:1 port: the old JS remove() closed
	// the journal but never deleted its file, which is why 3 orphaned journal
	// files already exist on the real share. This unlinks the journal + its
	// checkpoint (ENOENT-tolerant) so the new code stops growing that list —
	// the already-orphaned files on the real share are never touched, since
	// nothing here ever references a courseId that isn't in courses.json.
	async remove(id: string): Promise<boolean> {
		const current = this._mf.get();
		const exists = current.courses.some((c) => c.id === id);
		if (!exists) return false;
		await this._mf.set({ courses: current.courses.filter((c) => c.id !== id) });
		const js = this._journals.get(id);
		if (js) {
			await js.close();
			this._journals.delete(id);
		}
		const journalPath = this._journalPath(id);
		await fsp.unlink(journalPath).catch(() => {});
		await fsp.unlink(journalPath + '.checkpoint.json').catch(() => {});

		const lp = this._lecturePlansServices.get(id);
		if (lp) {
			await lp.close();
			this._lecturePlansServices.delete(id);
		}
		const lecturePlansPath = this._lecturePlansPath(id);
		await fsp.unlink(lecturePlansPath).catch(() => {});
		await fsp.unlink(lecturePlansPath + '.checkpoint.json').catch(() => {});
		const legacyPath = this._legacyLecturePlanPath(id);
		await fsp.unlink(legacyPath + '.migrated').catch(() => {});
		await fsp.unlink(legacyPath + '.checkpoint.json.migrated').catch(() => {});

		return true;
	}

	async copy(id: string): Promise<Course | null> {
		const source = this.getById(id);
		if (!source) return null;
		const sourceJournal = this.getJournal(id);
		const sourcePages = sourceJournal.getAll();
		const sourcePlans = this.getLecturePlans(id).getAll();
		const newCourse = await this.create({ title: `${source.title} (Copy)` });
		const newJournal = this.getJournal(newCourse.id);
		for (const page of sourcePages) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = page;
			await newJournal.create(resetPageState(rest) as { type: Page['type']; title: string } & Record<string, unknown>);
		}
		const clonedPlans: LecturePlan[] = sourcePlans.map((plan) => ({
			...plan,
			id: randomUUID(),
			createdAt: now(),
			updatedAt: now(),
			weeks: plan.weeks.map(
				(week): LectureWeek => ({
					id: randomUUID(),
					days: {
						mon: week.days.mon.map((c) => ({ ...c, id: randomUUID() })),
						tue: week.days.tue.map((c) => ({ ...c, id: randomUUID() })),
						wed: week.days.wed.map((c) => ({ ...c, id: randomUUID() })),
						thu: week.days.thu.map((c) => ({ ...c, id: randomUUID() })),
						fri: week.days.fri.map((c) => ({ ...c, id: randomUUID() }))
					}
				})
			)
		}));
		await this.getLecturePlans(newCourse.id).replaceAll(clonedPlans);
		return newCourse;
	}
}

let _service: CourseService | null = null;

export function getCourseService(): CourseService {
	if (!_service) {
		_service = new CourseService(path.join(getEnv().dataDir, 'course-journal'));
	}
	return _service;
}
