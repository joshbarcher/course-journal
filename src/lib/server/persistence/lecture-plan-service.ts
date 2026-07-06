// One LecturePlanService instance manages a single course's Weekly Lecture
// Plan via its own ManagedFile, sibling to (but independent of) the course's
// JournalService — kept separate so drag-driven moves don't share a dirty/
// flush cadence or corruption blast-radius with page-content edits.
import { randomUUID } from 'node:crypto';
import logger from '../../../../logger.js';
import { ManagedFile, type LogLevel } from './managed-file';
import {
	LecturePlanFileSchema,
	WEEKDAYS,
	type LecturePlan,
	type LecturePlanFile,
	type LectureCard,
	type LectureWeek,
	type Weekday
} from '$lib/schemas/lecture-plan';
import { emptyDayCards, findCard, moveCard, type MoveCardTarget } from '$lib/utils/lecture-plan-helpers';

function managedFileLog(level: LogLevel, msg: string, meta?: unknown) {
	(logger as unknown as Record<string, (msg: string, meta?: unknown) => void>)[level]?.(msg, meta);
}

export class LecturePlanService {
	private _mf: ManagedFile<LecturePlanFile>;

	constructor(filePath: string) {
		this._mf = new ManagedFile<LecturePlanFile>({
			filePath,
			name: 'lecture-plan',
			defaultValue: () => ({
				lecturePlan: { meetingDays: [], weeks: [{ id: randomUUID(), days: emptyDayCards() }] }
			}),
			parse: (str) => LecturePlanFileSchema.parse(JSON.parse(str)),
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

	getPlan(): LecturePlan {
		return { ...this._mf.get().lecturePlan };
	}

	getCard(cardId: string): { weekId: string; day: Weekday; card: LectureCard } | null {
		const plan = this._mf.get().lecturePlan;
		const loc = findCard(plan, cardId);
		if (!loc) return null;
		const week = plan.weeks[loc.weekIdx];
		return { weekId: week.id, day: loc.day, card: week.days[loc.day][loc.cardIdx] };
	}

	async setMeetingDays(days: Weekday[]): Promise<LecturePlan> {
		const current = this._mf.get().lecturePlan;
		const meetingDays = WEEKDAYS.filter((d) => days.includes(d));
		const next = { ...current, meetingDays };
		await this._mf.set({ lecturePlan: next });
		return next;
	}

	async addWeek(id?: string): Promise<LecturePlan> {
		const current = this._mf.get().lecturePlan;
		const week: LectureWeek = { id: id ?? randomUUID(), days: emptyDayCards() };
		const next = { ...current, weeks: [...current.weeks, week] };
		await this._mf.set({ lecturePlan: next });
		return next;
	}

	async removeWeek(weekId: string): Promise<LecturePlan | null> {
		const current = this._mf.get().lecturePlan;
		if (!current.weeks.some((w) => w.id === weekId)) return null;
		const next = { ...current, weeks: current.weeks.filter((w) => w.id !== weekId) };
		await this._mf.set({ lecturePlan: next });
		return next;
	}

	async addCard(
		weekId: string,
		data: { id?: string; day: Weekday; durationHours: number; topics?: string }
	): Promise<LectureCard | null> {
		const current = this._mf.get().lecturePlan;
		const weekIdx = current.weeks.findIndex((w) => w.id === weekId);
		if (weekIdx === -1) return null;
		const card: LectureCard = {
			id: data.id ?? randomUUID(),
			durationHours: data.durationHours,
			topics: data.topics ?? ''
		};
		const weeks = [...current.weeks];
		const week = weeks[weekIdx];
		weeks[weekIdx] = { ...week, days: { ...week.days, [data.day]: [...week.days[data.day], card] } };
		await this._mf.set({ lecturePlan: { ...current, weeks } });
		return card;
	}

	async updateCard(cardId: string, patch: Record<string, unknown>): Promise<LectureCard | null> {
		const current = this._mf.get().lecturePlan;
		const loc = findCard(current, cardId);
		if (!loc) return null;
		const weeks = [...current.weeks];
		const week = weeks[loc.weekIdx];
		const dayArr = [...week.days[loc.day]];
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _id, ...safe } = patch;
		const updated = { ...dayArr[loc.cardIdx], ...safe } as LectureCard;
		dayArr[loc.cardIdx] = updated;
		weeks[loc.weekIdx] = { ...week, days: { ...week.days, [loc.day]: dayArr } };
		await this._mf.set({ lecturePlan: { ...current, weeks } });
		return updated;
	}

	async removeCard(cardId: string): Promise<boolean> {
		const current = this._mf.get().lecturePlan;
		const loc = findCard(current, cardId);
		if (!loc) return false;
		const weeks = [...current.weeks];
		const week = weeks[loc.weekIdx];
		const dayArr = week.days[loc.day].filter((c) => c.id !== cardId);
		weeks[loc.weekIdx] = { ...week, days: { ...week.days, [loc.day]: dayArr } };
		await this._mf.set({ lecturePlan: { ...current, weeks } });
		return true;
	}

	async moveCard(cardId: string, target: MoveCardTarget): Promise<boolean> {
		const current = this._mf.get().lecturePlan;
		if (!findCard(current, cardId)) return false;
		const next = moveCard(current, cardId, target);
		await this._mf.set({ lecturePlan: next });
		return true;
	}

	// Used only by CourseService.copy() to seed a duplicated course's plan.
	async replacePlan(plan: LecturePlan): Promise<void> {
		await this._mf.set({ lecturePlan: plan });
	}
}
