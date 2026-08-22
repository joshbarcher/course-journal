import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
	EXPORT_FORMATS,
	exportFilename,
	formatTimestamp,
	isExportFormat,
	isLecturePlan,
	renderExport
} from './export-page';
import type { Page } from '$lib/schemas/page';
import type { LecturePlan } from '$lib/schemas/lecture-plan';

const STAMPS = { createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-20T14:32:07.000Z' };

function listPage(overrides: Partial<Page> = {}): Page {
	return {
		id: 'p1',
		type: 'list',
		title: 'Reading List',
		ordered: true,
		items: [
			{ id: 'i1', title: 'Chapter One', subtasks: ['skim it', 'take notes'], order: 0, done: true },
			{ id: 'i2', title: 'Chapter Two', subtasks: [], order: 1, done: false }
		],
		...STAMPS,
		...overrides
	} as Page;
}

function progressPage(overrides: Partial<Page> = {}): Page {
	return {
		id: 'p2',
		type: 'progress',
		title: 'Setup',
		tasks: [
			{ id: 't1', title: 'Install', subtitle: 'node 24', state: 'done' },
			{ id: 't2', title: 'Configure', subtitle: '', state: 'working' },
			{ id: 't3', title: 'Stretch goal', subtitle: '', state: null, optional: true }
		],
		notes: 'remember the env file',
		...STAMPS,
		...overrides
	} as Page;
}

function barsPage(overrides: Partial<Page> = {}): Page {
	return {
		id: 'p3',
		type: 'progress-bars',
		title: 'Modules',
		bars: [
			{ id: 'b1', title: 'Module A', steps: [{ id: 's1', title: 'Watch lecture', subtitle: '', state: 'done' }] },
			{ id: 'b2', title: 'Module B', steps: [{ id: 's2', title: 'Do lab', subtitle: '', state: null }] }
		],
		notes: '',
		...STAMPS,
		...overrides
	} as Page;
}

function notesPage(overrides: Partial<Page> = {}): Page {
	return {
		id: 'p4',
		type: 'notes',
		title: 'Ideas',
		notes: [
			{ id: 'n1', text: 'first idea', createdAt: '2026-08-20T14:32:00.000Z' },
			{ id: 'n2', text: 'second idea\nwith a second line', createdAt: '2026-08-19T09:00:00.000Z' }
		],
		...STAMPS,
		...overrides
	} as Page;
}

function contentPage(overrides: Partial<Page> = {}): Page {
	return {
		id: 'p5',
		type: 'page',
		title: 'Syllabus',
		content: '<div>Week one</div><div><b>Week two</b></div>',
		...STAMPS,
		...overrides
	} as Page;
}

function plan(overrides: Partial<LecturePlan> = {}): LecturePlan {
	return {
		id: 'lp1',
		title: 'Summer Plan',
		meetingDays: ['mon', 'wed'],
		weeks: [
			{
				id: 'w1',
				days: {
					mon: [
						{ id: 'c1', durationHours: 1, topics: 'Intro' },
						{ id: 'c2', durationHours: 0.5, topics: 'Lab' }
					],
					tue: [],
					wed: [{ id: 'c3', durationHours: 0.75, topics: 'Derivatives' }],
					thu: [],
					fri: []
				}
			},
			{ id: 'w2', days: { mon: [], tue: [], wed: [], thu: [], fri: [] } }
		],
		...STAMPS,
		...overrides
	} as LecturePlan;
}

describe('format helpers', () => {
	it('renders a stored ISO timestamp deterministically, without a locale', () => {
		assert.equal(formatTimestamp('2026-08-20T14:32:07.000Z'), '2026-08-20 14:32 UTC');
	});
	it('passes through a timestamp it cannot parse rather than showing Invalid Date', () => {
		assert.equal(formatTimestamp('not a date'), 'not a date');
		assert.equal(formatTimestamp(''), '');
	});
	it('recognises only the two supported formats', () => {
		assert.deepEqual([...EXPORT_FORMATS], ['md', 'txt']);
		assert.equal(isExportFormat('md'), true);
		assert.equal(isExportFormat('txt'), true);
		assert.equal(isExportFormat('pdf'), false);
		assert.equal(isExportFormat(undefined), false);
	});
	it('tells a lecture plan apart from a page by the absence of a type', () => {
		assert.equal(isLecturePlan(plan()), true);
		assert.equal(isLecturePlan(listPage()), false);
	});
});

describe('exportFilename', () => {
	it('slugs the title and appends the format', () => {
		assert.equal(exportFilename('Reading List', 'md'), 'reading-list.md');
		assert.equal(exportFilename('Reading List', 'txt'), 'reading-list.txt');
	});
	it('strips accents and punctuation that would break a header or a filesystem', () => {
		assert.equal(exportFilename('Café "notes"/2026', 'md'), 'cafe-notes-2026.md');
		assert.equal(exportFilename('a\\b:c*d?e', 'md'), 'a-b-c-d-e.md');
	});
	it('falls back to a generic name when nothing survives slugging', () => {
		assert.equal(exportFilename('', 'md'), 'export.md');
		assert.equal(exportFilename('???', 'txt'), 'export.txt');
	});
	it('trims a long title without leaving a trailing dash', () => {
		const name = exportFilename('x'.repeat(40) + ' ' + 'y'.repeat(40), 'md');
		assert.ok(name.length <= 64, name);
		assert.doesNotMatch(name, /-\.md$/);
	});
});

describe('renderExport — list page', () => {
	it('renders the whole document in markdown', () => {
		assert.equal(
			renderExport(listPage(), 'md'),
			[
				'# Reading List',
				'',
				'_List · 1/2 done (50%) · ordered · updated 2026-08-20 14:32 UTC_',
				'',
				'1. [x] Chapter One',
				'   - skim it',
				'   - take notes',
				'2. [ ] Chapter Two',
				''
			].join('\n')
		);
	});
	it('renders the whole document in plain text, with an underlined title', () => {
		assert.equal(
			renderExport(listPage(), 'txt'),
			[
				'Reading List',
				'============',
				'',
				'List · 1/2 done (50%) · ordered · updated 2026-08-20 14:32 UTC',
				'',
				'1. [x] Chapter One',
				'   - skim it',
				'   - take notes',
				'2. [ ] Chapter Two',
				''
			].join('\n')
		);
	});
	it('uses dashes and reports unordered when the list is unordered', () => {
		const md = renderExport(listPage({ ordered: false } as Partial<Page>), 'md');
		assert.match(md, /unordered/);
		assert.match(md, /^- \[x\] Chapter One$/m);
		assert.match(md, /^ {2}- skim it$/m);
	});
	it('sorts items by order rather than array position', () => {
		const page = listPage({
			items: [
				{ id: 'i2', title: 'Second', subtasks: [], order: 1, done: false },
				{ id: 'i1', title: 'First', subtasks: [], order: 0, done: false }
			]
		} as Partial<Page>);
		assert.match(renderExport(page, 'md'), /1\. \[ \] First\n2\. \[ \] Second/);
	});
	it('says so when there is nothing to export', () => {
		assert.match(renderExport(listPage({ items: [] } as Partial<Page>), 'md'), /_No items yet_/);
		assert.match(renderExport(listPage({ items: [] } as Partial<Page>), 'txt'), /\(No items yet\)/);
	});
});

describe('renderExport — progress page', () => {
	it('renders tasks as checkboxes with their state, and the notes as a section', () => {
		assert.equal(
			renderExport(progressPage(), 'md'),
			[
				'# Setup',
				'',
				'_Progress Tracker · 50% complete (1/2 required done) · updated 2026-08-20 14:32 UTC_',
				'',
				'- [x] Install — Done',
				'  node 24',
				'- [ ] Configure — Working',
				'- [ ] Stretch goal — Not started, optional',
				'',
				'## Notes',
				'',
				'remember the env file',
				''
			].join('\n')
		);
	});
	it('omits the notes section entirely when there are no notes', () => {
		assert.doesNotMatch(renderExport(progressPage({ notes: '   ' } as Partial<Page>), 'md'), /Notes/);
	});
	it('handles a tracker with no tasks', () => {
		const md = renderExport(progressPage({ tasks: [], notes: '' } as Partial<Page>), 'md');
		assert.match(md, /0% complete \(0\/0 required done\)/);
		assert.match(md, /_No tasks yet_/);
	});
});

describe('renderExport — multi-bar progress page', () => {
	it('gives each bar its own section with a percentage', () => {
		assert.equal(
			renderExport(barsPage(), 'md'),
			[
				'# Modules',
				'',
				'_Multi-Bar Progress Tracker · 50% complete · 2 bars · updated 2026-08-20 14:32 UTC_',
				'',
				'## 1. Module A — 100%',
				'',
				'- [x] Watch lecture — Done',
				'',
				'## 2. Module B — 0%',
				'',
				'- [ ] Do lab — Not started',
				''
			].join('\n')
		);
	});
	it('marks an optional bar and an empty one', () => {
		const page = barsPage({
			bars: [{ id: 'b1', title: 'Extra credit', optional: true, steps: [] }]
		} as Partial<Page>);
		const md = renderExport(page, 'md');
		assert.match(md, /## 1\. Extra credit — 0% \(optional\)/);
		assert.match(md, /_No steps_/);
	});
});

describe('renderExport — notes page', () => {
	it('gives each note a timestamped heading and keeps its line breaks', () => {
		assert.equal(
			renderExport(notesPage(), 'md'),
			[
				'# Ideas',
				'',
				'_Notes · 2 notes · updated 2026-08-20 14:32 UTC_',
				'',
				'## 2026-08-20 14:32 UTC',
				'',
				'first idea',
				'',
				'## 2026-08-19 09:00 UTC',
				'',
				'second idea',
				'with a second line',
				''
			].join('\n')
		);
	});
	it('counts a single note in the singular', () => {
		const page = notesPage({ notes: [{ id: 'n1', text: 'only', createdAt: STAMPS.createdAt }] } as Partial<Page>);
		assert.match(renderExport(page, 'md'), /· 1 note ·/);
	});
	it('escapes note text that would otherwise be swallowed as markup', () => {
		const page = notesPage({
			notes: [{ id: 'n1', text: 'use a Map<String, Integer> here', createdAt: STAMPS.createdAt }]
		} as Partial<Page>);
		assert.match(renderExport(page, 'md'), /^use a Map\\<String, Integer> here$/m);
		assert.match(renderExport(page, 'txt'), /^use a Map<String, Integer> here$/m);
	});
	it('leaves a hand-typed bullet in a note as a real bullet', () => {
		const page = notesPage({ notes: [{ id: 'n1', text: '- a bullet', createdAt: STAMPS.createdAt }] } as Partial<Page>);
		assert.match(renderExport(page, 'md'), /^- a bullet$/m);
	});
});

describe('renderExport — rich-text page', () => {
	it('converts the stored HTML to markdown', () => {
		assert.equal(
			renderExport(contentPage(), 'md'),
			['# Syllabus', '', '_Page · updated 2026-08-20 14:32 UTC_', '', 'Week one', '**Week two**', ''].join('\n')
		);
	});
	it('strips the formatting for the plain-text export', () => {
		assert.match(renderExport(contentPage(), 'txt'), /^Week one\nWeek two$/m);
	});
	it('reports an empty page instead of trailing off', () => {
		assert.match(renderExport(contentPage({ content: '' } as Partial<Page>), 'md'), /_Empty page_/);
		assert.match(renderExport(contentPage({ content: '<div><br></div>' } as Partial<Page>), 'md'), /_Empty page_/);
	});
});

describe('renderExport — weekly lecture plan', () => {
	it('renders weeks, days and durations', () => {
		assert.equal(
			renderExport(plan(), 'md'),
			[
				'# Summer Plan',
				'',
				'_Weekly Lecture Plan · 2 weeks · 3 lectures · 2h15 total · meets Mon, Wed · updated 2026-08-20 14:32 UTC_',
				'',
				'## Week 1 — 2h15',
				'',
				'**Mon** (1h30)',
				'- 1h — Intro',
				'- 30m — Lab',
				'',
				'**Wed** (45m)',
				'- 45m — Derivatives',
				'',
				'## Week 2',
				'',
				'**Mon** — no lectures',
				'',
				'**Wed** — no lectures',
				''
			].join('\n')
		);
	});
	it('drops the bold markers in plain text', () => {
		const txt = renderExport(plan(), 'txt');
		assert.match(txt, /^Mon \(1h30\)$/m);
		assert.doesNotMatch(txt, /\*\*/);
	});
	it('shows a day that has lectures even when it is not a meeting day', () => {
		const p = plan({ meetingDays: ['mon'] });
		const md = renderExport(p, 'md');
		assert.match(md, /\*\*Wed\*\* \(45m\)/);
		assert.doesNotMatch(md, /\*\*Tue\*\*/);
	});
	it('hides empty days entirely when no meeting pattern is set', () => {
		const p = plan({ meetingDays: [] });
		const md = renderExport(p, 'md');
		assert.doesNotMatch(md, /no lectures/);
		assert.match(md, /## Week 2\n\n_No lectures scheduled_/);
	});
	it('marks a card that has no topic yet', () => {
		const p = plan({
			meetingDays: [],
			weeks: [{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: 1, topics: '' }], tue: [], wed: [], thu: [], fri: [] } }]
		} as Partial<LecturePlan>);
		assert.match(renderExport(p, 'md'), /- 1h — _no topic_/);
		assert.match(renderExport(p, 'txt'), /- 1h — \(no topic\)/);
	});
	it('puts extra topic lines under the bullet', () => {
		const p = plan({
			meetingDays: [],
			weeks: [
				{ id: 'w1', days: { mon: [{ id: 'c1', durationHours: 1, topics: 'Intro\nand a follow-up' }], tue: [], wed: [], thu: [], fri: [] } }
			]
		} as Partial<LecturePlan>);
		assert.match(renderExport(p, 'md'), /- 1h — Intro\n {2}and a follow-up/);
	});
	it('handles a plan with no weeks at all', () => {
		assert.match(renderExport(plan({ weeks: [] }), 'md'), /_No weeks yet_/);
	});
});

describe('renderExport — shared shape', () => {
	it('always starts with the title and ends with exactly one newline', () => {
		for (const record of [listPage(), progressPage(), barsPage(), notesPage(), contentPage(), plan()]) {
			for (const format of EXPORT_FORMATS) {
				const text = renderExport(record, format);
				assert.ok(text.startsWith(format === 'md' ? '# ' : record.title), `${record.title} ${format}`);
				assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'), `${record.title} ${format}`);
				assert.doesNotMatch(text, /\n{3,}/, `${record.title} ${format}`);
			}
		}
	});
	it('falls back to a placeholder title rather than an empty heading', () => {
		assert.match(renderExport(listPage({ title: '' } as Partial<Page>), 'md'), /^# Untitled$/m);
	});
	it('escapes a title that contains markdown characters', () => {
		assert.match(renderExport(listPage({ title: 'Chapter *3*' } as Partial<Page>), 'md'), /^# Chapter \\\*3\\\*$/m);
	});
});
