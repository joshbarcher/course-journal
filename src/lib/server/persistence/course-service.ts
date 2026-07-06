// Ported from src/services/courseService.js — manages courses.json plus one
// JournalService per course (lazily created/loaded, cached in a Map).
import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../../../../logger.js';
import { ManagedFile, type LogLevel } from './managed-file';
import { CoursesFileSchema, type Course, type CoursesFile } from '$lib/schemas/course';
import { JournalService } from './journal-service';
import { LecturePlanService } from './lecture-plan-service';
import type { Page } from '$lib/schemas/page';
import type { LecturePlan, LectureWeek } from '$lib/schemas/lecture-plan';
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
	private _lecturePlans: Map<string, LecturePlanService>;

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
		this._lecturePlans = new Map();
	}

	private _journalPath(courseId: string): string {
		return path.join(this._coursesDir, `${courseId}.json`);
	}

	private _lecturePlanPath(courseId: string): string {
		return path.join(this._coursesDir, `${courseId}.lecture-plan.json`);
	}

	async load(): Promise<void> {
		await this._mf.load();
		for (const course of this._mf.get().courses) {
			await this._ensureJournal(course.id);
			await this._ensureLecturePlan(course.id);
		}
	}

	async flush(): Promise<void> {
		await this._mf.flush();
		for (const js of this._journals.values()) {
			await js.flush();
		}
		for (const lp of this._lecturePlans.values()) {
			await lp.flush();
		}
	}

	async close(): Promise<void> {
		await this._mf.close();
		for (const js of this._journals.values()) {
			await js.close();
		}
		for (const lp of this._lecturePlans.values()) {
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

	private async _ensureLecturePlan(courseId: string): Promise<LecturePlanService> {
		if (!this._lecturePlans.has(courseId)) {
			const lp = new LecturePlanService(this._lecturePlanPath(courseId));
			await lp.load();
			this._lecturePlans.set(courseId, lp);
		}
		return this._lecturePlans.get(courseId)!;
	}

	getJournal(courseId: string): JournalService {
		const js = this._journals.get(courseId);
		if (!js) throw new Error(`No journal for course ${courseId}`);
		return js;
	}

	getLecturePlan(courseId: string): LecturePlanService {
		const lp = this._lecturePlans.get(courseId);
		if (!lp) throw new Error(`No lecture plan for course ${courseId}`);
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
		await this._ensureLecturePlan(course.id);
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

		const lp = this._lecturePlans.get(id);
		if (lp) {
			await lp.close();
			this._lecturePlans.delete(id);
		}
		const lecturePlanPath = this._lecturePlanPath(id);
		await fsp.unlink(lecturePlanPath).catch(() => {});
		await fsp.unlink(lecturePlanPath + '.checkpoint.json').catch(() => {});

		return true;
	}

	async copy(id: string): Promise<Course | null> {
		const source = this.getById(id);
		if (!source) return null;
		const sourceJournal = this.getJournal(id);
		const sourcePages = sourceJournal.getAll();
		const sourcePlan = this.getLecturePlan(id).getPlan();
		const newCourse = await this.create({ title: `${source.title} (Copy)` });
		const newJournal = this.getJournal(newCourse.id);
		for (const page of sourcePages) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = page;
			await newJournal.create(resetPageState(rest) as { type: Page['type']; title: string } & Record<string, unknown>);
		}
		const clonedPlan: LecturePlan = {
			meetingDays: [...sourcePlan.meetingDays],
			weeks: sourcePlan.weeks.map(
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
		};
		await this.getLecturePlan(newCourse.id).replacePlan(clonedPlan);
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
