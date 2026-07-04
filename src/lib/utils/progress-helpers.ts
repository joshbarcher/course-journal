// Ported verbatim from public/js/views/progress-helpers.js — pure, no DOM,
// shared across the progress/progress-bars page components and (in M4) the
// heatmap view.
import type { Page, ProgressBar, ProgressTask } from '$lib/schemas/page';

export const STATE_COLORS = {
	done: '#4ecdc4',
	working: '#c9a84c',
	started: '#7ab8f5'
} as const;

const DIM = 'rgba(255,255,255,0.10)';

export type TaskState = ProgressTask['state'];

export function segmentColor(state: TaskState | undefined): string {
	return (state && STATE_COLORS[state]) ?? DIM;
}

export function barProgressPercent(bar: { steps?: ProgressTask[] }): number {
	const steps = (bar.steps ?? []).filter((s) => !s.optional);
	if (!steps.length) return 0;
	const done = steps.filter((s) => s.state === 'done').length;
	return Math.round((done / steps.length) * 100);
}

export function percentToColor(pct: number): string {
	if (pct >= 100) return STATE_COLORS.done;
	if (pct >= 50) return STATE_COLORS.working;
	if (pct > 0) return STATE_COLORS.started;
	return DIM;
}

const STATE_DISPLAY: Record<string, string> = { started: 'Started', working: 'Working', done: 'Done' };

export function stateLabel(state: TaskState | undefined): string {
	return (state && STATE_DISPLAY[state]) ?? '';
}

export function percentToStateLabel(pct: number): string {
	if (pct >= 100) return 'Done';
	if (pct >= 50) return 'Working';
	if (pct > 0) return 'Started';
	return '';
}

export interface Segment {
	num: number;
	color: string;
	label: string;
	stateLabel: string;
	optional: boolean;
	done: boolean;
}

export interface HeatmapRow {
	id: string;
	title: string;
	cells: Segment[];
}

// Returns heatmap row data for all progress/progress-bars/list pages.
export function heatmapRows(pages: Page[]): HeatmapRow[] {
	return pages
		.filter((p) => p.type === 'progress' || p.type === 'progress-bars' || p.type === 'list')
		.map((p) => ({ id: p.id, title: p.title, cells: globalSegments(p) }));
}

export function globalSegments(page: Page): Segment[] {
	if (page.type === 'progress') {
		return (page.tasks ?? []).map((t, i) => ({
			num: i + 1,
			color: segmentColor(t.state),
			label: t.title,
			stateLabel: stateLabel(t.state),
			optional: !!t.optional,
			done: t.state === 'done'
		}));
	}
	if (page.type === 'progress-bars') {
		return (page.bars ?? []).map((b: ProgressBar, i) => {
			const pct = barProgressPercent(b);
			return {
				num: i + 1,
				color: percentToColor(pct),
				label: b.title,
				stateLabel: percentToStateLabel(pct),
				optional: !!b.optional,
				done: pct >= 100
			};
		});
	}
	if (page.type === 'list') {
		return (page.items ?? []).map((item, i) => ({
			num: i + 1,
			color: item.done ? STATE_COLORS.done : DIM,
			label: item.title,
			stateLabel: item.done ? 'Done' : '',
			optional: false,
			done: !!item.done
		}));
	}
	return [];
}
