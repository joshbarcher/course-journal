import { z } from 'zod';

export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri']);
export type Weekday = z.infer<typeof WeekdaySchema>;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const satisfies readonly Weekday[];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
	mon: 'Mon',
	tue: 'Tue',
	wed: 'Wed',
	thu: 'Thu',
	fri: 'Fri'
};

// No `order` field — array position is the order, same convention as the
// top-level `pages` array and NotesPage's `notes` array.
export const LectureCardSchema = z.looseObject({
	id: z.string(),
	durationHours: z.number().min(0),
	topics: z.string().default('')
});
export type LectureCard = z.infer<typeof LectureCardSchema>;

// 0m–2h in 15-minute increments, for the duration dropdown.
export const DURATION_OPTIONS_HOURS = Array.from({ length: 9 }, (_, i) => i * 0.25);

// No space in the combined form ("1h45", not "1h 45m") — this has to fit
// inside a narrow dropdown box, and every extra character costs width.
export function formatDurationHours(hours: number): string {
	const totalMinutes = Math.round(hours * 60);
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h${m}`;
}

export const DayCardsSchema = z.looseObject({
	mon: z.array(LectureCardSchema).default([]),
	tue: z.array(LectureCardSchema).default([]),
	wed: z.array(LectureCardSchema).default([]),
	thu: z.array(LectureCardSchema).default([]),
	fri: z.array(LectureCardSchema).default([])
});
export type DayCards = z.infer<typeof DayCardsSchema>;

export const LectureWeekSchema = z.looseObject({
	id: z.string(),
	days: DayCardsSchema
});
export type LectureWeek = z.infer<typeof LectureWeekSchema>;

export const LecturePlanSchema = z.looseObject({
	meetingDays: z.array(WeekdaySchema).default([]),
	weeks: z.array(LectureWeekSchema).default([])
});
export type LecturePlan = z.infer<typeof LecturePlanSchema>;

export const LecturePlanFileSchema = z.looseObject({
	lecturePlan: LecturePlanSchema
});
export type LecturePlanFile = z.infer<typeof LecturePlanFileSchema>;
