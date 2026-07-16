// One LecturePlansService instance manages a single course's *collection* of
// named Weekly Lecture Plans via its own ManagedFile, sibling to (but
// independent of) the course's JournalService — kept separate so
// drag-driven moves don't share a dirty/flush cadence or corruption
// blast-radius with page-content edits.
import { randomUUID } from 'node:crypto';
import logger from '../../../../logger.js';
import { ManagedFile, type LogLevel } from './managed-file';
import {
	LecturePlansFileSchema,
	WEEKDAYS,
	type LecturePlan,
	type LecturePlansFile,
	type LectureCard,
	type Weekday
} from '$lib/schemas/lecture-plan';
import { emptyDayCards, findCard, moveCard, type MoveCardTarget } from '$lib/utils/lecture-plan-helpers';

function managedFileLog(level: LogLevel, msg: string, meta?: unknown) {
	(logger as unknown as Record<string, (msg: string, meta?: unknown) => void>)[level]?.(msg, meta);
}

function now(): string {
	return new Date().toISOString();
}

export class LecturePlansService {
	private _mf: ManagedFile<LecturePlansFile>;

	constructor(filePath: string) {
		this._mf = new ManagedFile<LecturePlansFile>({
			filePath,
			name: 'lecture-plans',
			defaultValue: () => ({ lecturePlans: [] }),
			parse: (str) => LecturePlansFileSchema.parse(JSON.parse(str)),
			maxFlushIntervalMs: 30_000,
			log: managedFileLog
		});
	}

	async load(): Promise<void> {
		await this._mf.load();
	}

	async flush(): Promise<void> {
		await this._mf.flush();
	}

	async close(): Promise<void> {
		await this._mf.close();
	}

	getAll(): LecturePlan[] {
		return [...this._mf.get().lecturePlans];
	}

	getById(planId: string): LecturePlan | null {
		const plan = this._mf.get().lecturePlans.find((p) => p.id === planId);
		return plan ? { ...plan } : null;
	}

	async create(title: string, id?: string): Promise<LecturePlan> {
		const current = this._mf.get();
		const plan: LecturePlan = {
			id: id ?? randomUUID(),
			title,
			createdAt: now(),
			updatedAt: now(),
			meetingDays: [],
			weeks: [{ id: randomUUID(), days: emptyDayCards() }]
		};
		await this._mf.set({ lecturePlans: [...current.lecturePlans, plan] });
		return plan;
	}

	async rename(planId: string, title: string): Promise<LecturePlan | null> {
		return this._mutatePlan(planId, (plan) => ({ ...plan, title }));
	}

	async remove(planId: string): Promise<boolean> {
		const current = this._mf.get();
		const exists = current.lecturePlans.some((p) => p.id === planId);
		if (!exists) return false;
		await this._mf.set({ lecturePlans: current.lecturePlans.filter((p) => p.id !== planId) });
		return true;
	}

	// Used only by CourseService.copy() to seed a duplicated course's plans.
	async replaceAll(plans: LecturePlan[]): Promise<void> {
		await this._mf.set({ lecturePlans: plans });
	}

	getCard(planId: string, cardId: string): { weekId: string; day: Weekday; card: LectureCard } | null {
		const plan = this.getById(planId);
		if (!plan) return null;
		const loc = findCard(plan, cardId);
		if (!loc) return null;
		const week = plan.weeks[loc.weekIdx];
		return { weekId: week.id, day: loc.day, card: week.days[loc.day][loc.cardIdx] };
	}

	async setMeetingDays(planId: string, days: Weekday[]): Promise<LecturePlan | null> {
		const meetingDays = WEEKDAYS.filter((d) => days.includes(d));
		return this._mutatePlan(planId, (plan) => ({ ...plan, meetingDays }));
	}

	async addWeek(planId: string, weekId?: string): Promise<LecturePlan | null> {
		return this._mutatePlan(planId, (plan) => ({
			...plan,
			weeks: [...plan.weeks, { id: weekId ?? randomUUID(), days: emptyDayCards() }]
		}));
	}

	async removeWeek(planId: string, weekId: string): Promise<LecturePlan | null> {
		const plan = this.getById(planId);
		if (!plan || !plan.weeks.some((w) => w.id === weekId)) return null;
		return this._mutatePlan(planId, (p) => ({ ...p, weeks: p.weeks.filter((w) => w.id !== weekId) }));
	}

	async addCard(
		planId: string,
		weekId: string,
		data: { id?: string; day: Weekday; durationHours: number; topics?: string }
	): Promise<LectureCard | null> {
		const plan = this.getById(planId);
		if (!plan) return null;
		const weekIdx = plan.weeks.findIndex((w) => w.id === weekId);
		if (weekIdx === -1) return null;
		const card: LectureCard = {
			id: data.id ?? randomUUID(),
			durationHours: data.durationHours,
			topics: data.topics ?? ''
		};
		const updated = await this._mutatePlan(planId, (p) => {
			const weeks = [...p.weeks];
			const week = weeks[weekIdx];
			weeks[weekIdx] = { ...week, days: { ...week.days, [data.day]: [...week.days[data.day], card] } };
			return { ...p, weeks };
		});
		return updated ? card : null;
	}

	async updateCard(planId: string, cardId: string, patch: Record<string, unknown>): Promise<LectureCard | null> {
		const plan = this.getById(planId);
		if (!plan) return null;
		const loc = findCard(plan, cardId);
		if (!loc) return null;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _id, ...safe } = patch;
		let updatedCard: LectureCard | null = null;
		await this._mutatePlan(planId, (p) => {
			const weeks = [...p.weeks];
			const week = weeks[loc.weekIdx];
			const dayArr = [...week.days[loc.day]];
			updatedCard = { ...dayArr[loc.cardIdx], ...safe } as LectureCard;
			dayArr[loc.cardIdx] = updatedCard;
			weeks[loc.weekIdx] = { ...week, days: { ...week.days, [loc.day]: dayArr } };
			return { ...p, weeks };
		});
		return updatedCard;
	}

	async removeCard(planId: string, cardId: string): Promise<boolean> {
		const plan = this.getById(planId);
		if (!plan) return false;
		const loc = findCard(plan, cardId);
		if (!loc) return false;
		await this._mutatePlan(planId, (p) => {
			const weeks = [...p.weeks];
			const week = weeks[loc.weekIdx];
			weeks[loc.weekIdx] = {
				...week,
				days: { ...week.days, [loc.day]: week.days[loc.day].filter((c) => c.id !== cardId) }
			};
			return { ...p, weeks };
		});
		return true;
	}

	async moveCard(planId: string, cardId: string, target: MoveCardTarget): Promise<boolean> {
		const plan = this.getById(planId);
		if (!plan || !findCard(plan, cardId)) return false;
		// The target week must exist too, or the move is a silent no-op:
		// the pure moveCard() helper returns the plan unchanged when the
		// target week id isn't found, and reporting success here would let
		// the route reply 200 for a move that never happened (its 404
		// contract explicitly covers "target week not found").
		if (!plan.weeks.some((w) => w.id === target.weekId)) return false;
		await this._mutatePlan(planId, (p) => moveCard(p, cardId, target));
		return true;
	}

	// Shared immutable-update helper for every weeks/pattern mutator above:
	// read current plans, replace the one matching planId via `updater`,
	// stamp updatedAt, write the whole array back in one set().
	private async _mutatePlan(
		planId: string,
		updater: (plan: LecturePlan) => LecturePlan
	): Promise<LecturePlan | null> {
		const current = this._mf.get();
		const idx = current.lecturePlans.findIndex((p) => p.id === planId);
		if (idx === -1) return null;
		const updated = { ...updater(current.lecturePlans[idx]), updatedAt: now() };
		const lecturePlans = [...current.lecturePlans];
		lecturePlans[idx] = updated;
		await this._mf.set({ lecturePlans });
		return updated;
	}
}
