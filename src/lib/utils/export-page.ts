// Renders any single record the app owns — a journal page of any type, or a
// named Weekly Lecture Plan — as Markdown or plain text, so it can be pulled
// out of the app and worked on somewhere else.
//
// Pure and DOM-free on purpose: the exact same function backs the in-app
// "Copy / Download" menu (client) and the GET .../export route (server), so
// a downloaded file and a curl'd one can never disagree.
import {
	WEEKDAYS,
	WEEKDAY_LABELS,
	formatDurationHours,
	type LectureCard,
	type LecturePlan,
	type Weekday
} from '$lib/schemas/lecture-plan';
import type {
	ContentPage,
	ListPage,
	NotesPage,
	Page,
	PageType,
	ProgressBarsPage,
	ProgressPage,
	ProgressTask
} from '$lib/schemas/page';
import { progressPercent } from './format';
import { sortedItems } from './list-helpers';
import { barProgressPercent, stateLabel } from './progress-helpers';
import { escapeMarkdown, htmlToMarkdown, htmlToPlainText } from './html-to-text';

export const EXPORT_FORMATS = ['md', 'txt'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
	md: 'text/markdown',
	txt: 'text/plain'
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
	md: 'Markdown',
	txt: 'Plain text'
};

export function isExportFormat(value: unknown): value is ExportFormat {
	return typeof value === 'string' && (EXPORT_FORMATS as readonly string[]).includes(value);
}

// Everything the app can export. Only Page carries a `type` discriminator,
// which is what tells the two record families apart.
export type Exportable = Page | LecturePlan;

export function isLecturePlan(record: Exportable): record is LecturePlan {
	return !('type' in record);
}

// Singular forms of the subtitles the page components already show
// (ProgressPage.svelte etc.), rather than TYPE_LABELS' plural group names.
const PAGE_KIND_LABELS: Record<PageType, string> = {
	list: 'List',
	progress: 'Progress Tracker',
	'progress-bars': 'Multi-Bar Progress Tracker',
	notes: 'Notes',
	page: 'Page'
};

// Timestamps are stored as ISO (UTC) strings. Formatting them with
// toLocaleString would make the same record export differently from the
// server route than from the browser — and differently again per machine —
// so the stored value is trimmed rather than converted.
export function formatTimestamp(iso: string): string {
	const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso ?? '');
	return m ? `${m[1]} ${m[2]} UTC` : (iso ?? '');
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function lineBuffer() {
	const lines: string[] = [];
	return {
		add(line = '') {
			lines.push(line);
		},
		blank() {
			if (lines.length && lines[lines.length - 1] !== '') lines.push('');
		},
		text(): string {
			return (
				lines
					.join('\n')
					.replace(/[ \t]+$/gm, '')
					.replace(/\n{3,}/g, '\n\n')
					.trim() + '\n'
			);
		}
	};
}

type Buffer = ReturnType<typeof lineBuffer>;

function inline(text: string, md: boolean): string {
	return md ? escapeMarkdown(text) : text;
}

function heading(out: Buffer, level: number, text: string, md: boolean): void {
	out.blank();
	if (md) {
		out.add(`${'#'.repeat(level)} ${escapeMarkdown(text)}`);
	} else {
		out.add(text);
		out.add((level === 1 ? '=' : '-').repeat(Math.max(3, text.length)));
	}
	out.add('');
}

// The one-line "what is this record" summary under the title.
function metaLine(out: Buffer, parts: (string | false | null | undefined)[], md: boolean): void {
	const line = parts.filter((p): p is string => Boolean(p)).join(' · ');
	if (!line) return;
	out.add(md ? `_${line}_` : line);
	out.add('');
}

function placeholder(text: string, md: boolean): string {
	return md ? `_${text}_` : `(${text})`;
}

// A multi-line free-text block: a tracker's notes field, or a note card's
// body. Lines are added one at a time so a lone "\n" in the source can't
// silently become a paragraph break in the output.
function addTextBlock(out: Buffer, text: string, md: boolean): void {
	for (const line of text.split(/\r?\n/)) out.add(md ? escapeMarkdown(line) : line);
}

function checkbox(done: boolean): string {
	return done ? '[x]' : '[ ]';
}

// ── Page types ────────────────────────────────────────────────────────────

function renderListPage(out: Buffer, page: ListPage, md: boolean): void {
	const items = sortedItems({ items: page.items ?? [] });
	const done = items.filter((i) => i.done).length;
	metaLine(
		out,
		[
			PAGE_KIND_LABELS.list,
			`${done}/${items.length} done (${progressPercent(page)}%)`,
			page.ordered ? 'ordered' : 'unordered',
			`updated ${formatTimestamp(page.updatedAt)}`
		],
		md
	);

	if (!items.length) {
		out.add(placeholder('No items yet', md));
		return;
	}

	items.forEach((item, i) => {
		const marker = page.ordered ? `${i + 1}.` : '-';
		out.add(`${marker} ${checkbox(item.done)} ${inline(item.title, md)}`);
		// Subtasks nest under their item, so they have to be indented past
		// the parent's marker ("1." is wider than "-").
		const indent = ' '.repeat(marker.length + 1);
		for (const subtask of item.subtasks ?? []) out.add(`${indent}- ${inline(subtask, md)}`);
	});
}

// Shared by ProgressPage's tasks and ProgressBarsPage's steps — the same
// shape in the schema (ProgressBarStepSchema === ProgressTaskSchema).
function taskLine(out: Buffer, task: ProgressTask, md: boolean): void {
	const tags = [stateLabel(task.state) || 'Not started'];
	if (task.optional) tags.push('optional');
	out.add(`- ${checkbox(task.state === 'done')} ${inline(task.title || 'Untitled', md)} — ${tags.join(', ')}`);
	if (task.subtitle) out.add(`  ${inline(task.subtitle, md)}`);
}

function notesSection(out: Buffer, notes: string | undefined, md: boolean): void {
	const text = (notes ?? '').trim();
	if (!text) return;
	heading(out, 2, 'Notes', md);
	addTextBlock(out, text, md);
}

function renderProgressPage(out: Buffer, page: ProgressPage, md: boolean): void {
	const tasks = page.tasks ?? [];
	const required = tasks.filter((t) => !t.optional);
	const done = required.filter((t) => t.state === 'done').length;
	metaLine(
		out,
		[
			PAGE_KIND_LABELS.progress,
			`${progressPercent(page)}% complete (${done}/${required.length} required done)`,
			`updated ${formatTimestamp(page.updatedAt)}`
		],
		md
	);

	if (!tasks.length) out.add(placeholder('No tasks yet', md));
	for (const task of tasks) taskLine(out, task, md);

	notesSection(out, page.notes, md);
}

function renderProgressBarsPage(out: Buffer, page: ProgressBarsPage, md: boolean): void {
	const bars = page.bars ?? [];
	metaLine(
		out,
		[
			PAGE_KIND_LABELS['progress-bars'],
			`${progressPercent(page)}% complete`,
			plural(bars.length, 'bar'),
			`updated ${formatTimestamp(page.updatedAt)}`
		],
		md
	);

	if (!bars.length) out.add(placeholder('No bars yet', md));

	bars.forEach((bar, i) => {
		const optional = bar.optional ? ' (optional)' : '';
		heading(out, 2, `${i + 1}. ${bar.title || 'Untitled'} — ${barProgressPercent(bar)}%${optional}`, md);
		const steps = bar.steps ?? [];
		if (!steps.length) out.add(placeholder('No steps', md));
		for (const step of steps) taskLine(out, step, md);
	});

	notesSection(out, page.notes, md);
}

function renderNotesPage(out: Buffer, page: NotesPage, md: boolean): void {
	const notes = page.notes ?? [];
	metaLine(out, [PAGE_KIND_LABELS.notes, plural(notes.length, 'note'), `updated ${formatTimestamp(page.updatedAt)}`], md);

	if (!notes.length) {
		out.add(placeholder('No notes yet', md));
		return;
	}

	for (const note of notes) {
		heading(out, 2, formatTimestamp(note.createdAt), md);
		addTextBlock(out, note.text, md);
	}
}

function renderContentPage(out: Buffer, page: ContentPage, md: boolean): void {
	metaLine(out, [PAGE_KIND_LABELS.page, `updated ${formatTimestamp(page.updatedAt)}`], md);
	const body = md ? htmlToMarkdown(page.content ?? '') : htmlToPlainText(page.content ?? '');
	if (!body) {
		out.add(placeholder('Empty page', md));
		return;
	}
	for (const line of body.split('\n')) out.add(line);
}

// ── Weekly lecture plans ──────────────────────────────────────────────────

function weekCards(week: { days: Record<Weekday, LectureCard[]> }): LectureCard[] {
	return WEEKDAYS.flatMap((day) => week.days[day] ?? []);
}

function totalHours(cards: LectureCard[]): number {
	return cards.reduce((sum, card) => sum + (card.durationHours ?? 0), 0);
}

function renderLecturePlan(out: Buffer, plan: LecturePlan, md: boolean): void {
	const weeks = plan.weeks ?? [];
	const allCards = weeks.flatMap(weekCards);
	const meetingDays = plan.meetingDays ?? [];
	const hours = totalHours(allCards);

	metaLine(
		out,
		[
			'Weekly Lecture Plan',
			plural(weeks.length, 'week'),
			plural(allCards.length, 'lecture'),
			hours > 0 && `${formatDurationHours(hours)} total`,
			meetingDays.length > 0 && `meets ${meetingDays.map((d) => WEEKDAY_LABELS[d]).join(', ')}`,
			`updated ${formatTimestamp(plan.updatedAt)}`
		],
		md
	);

	if (!weeks.length) {
		out.add(placeholder('No weeks yet', md));
		return;
	}

	weeks.forEach((week, i) => {
		const cards = weekCards(week);
		const weekHours = totalHours(cards);
		heading(out, 2, `Week ${i + 1}${weekHours > 0 ? ` — ${formatDurationHours(weekHours)}` : ''}`, md);

		// Days with lectures always appear; an empty day only appears when the
		// meeting pattern says it should have had one, so a missed session is
		// visible in the export instead of silently absent.
		const days = WEEKDAYS.filter((day) => (week.days[day] ?? []).length > 0 || meetingDays.includes(day));
		if (!days.length) {
			out.add(placeholder('No lectures scheduled', md));
			return;
		}

		for (const day of days) {
			const dayCards = week.days[day] ?? [];
			const label = WEEKDAY_LABELS[day];
			const dayHours = totalHours(dayCards);
			out.blank();
			if (!dayCards.length) {
				out.add(md ? `**${label}** — no lectures` : `${label} — no lectures`);
				continue;
			}
			out.add(md ? `**${label}** (${formatDurationHours(dayHours)})` : `${label} (${formatDurationHours(dayHours)})`);
			for (const card of dayCards) {
				// A card's topics box is a textarea; its first line becomes the
				// bullet and any others are continuation lines under it.
				const topicLines = (card.topics ?? '')
					.split(/\r?\n/)
					.map((line) => line.trim())
					.filter(Boolean);
				const first = topicLines.shift();
				const duration = formatDurationHours(card.durationHours ?? 0);
				out.add(`- ${duration}${first ? ` — ${inline(first, md)}` : ` — ${placeholder('no topic', md)}`}`);
				for (const line of topicLines) out.add(`  ${inline(line, md)}`);
			}
		}
	});
}

// ── Entry points ──────────────────────────────────────────────────────────

export function renderExport(record: Exportable, format: ExportFormat): string {
	const md = format === 'md';
	const out = lineBuffer();
	const title = record.title || 'Untitled';

	heading(out, 1, title, md);

	if (isLecturePlan(record)) {
		renderLecturePlan(out, record, md);
	} else {
		switch (record.type) {
			case 'list':
				renderListPage(out, record, md);
				break;
			case 'progress':
				renderProgressPage(out, record, md);
				break;
			case 'progress-bars':
				renderProgressBarsPage(out, record, md);
				break;
			case 'notes':
				renderNotesPage(out, record, md);
				break;
			case 'page':
				renderContentPage(out, record, md);
				break;
		}
	}

	return out.text();
}

// Slugged rather than the raw title: this value goes straight into a
// Content-Disposition header and onto a filesystem, where quotes, slashes
// and non-ASCII are all trouble.
export function exportFilename(title: string, format: ExportFormat): string {
	const slug = (title ?? '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 60)
		.replace(/^-+|-+$/g, '');
	return `${slug || 'export'}.${format}`;
}
