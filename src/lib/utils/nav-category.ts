// Shared between Sidebar.svelte (category highlighting) and
// Breadcrumbs.svelte (path segments) so the two can never drift on what
// counts as a "tracker" vs. a "document" or what each category is called.
import type { Page, PageType } from '$lib/schemas/page';

export type NavCategory = 'trackers' | 'documents' | 'planners';

const TRACKER_TYPES = new Set<PageType>(['progress', 'progress-bars', 'list']);

export const NAV_CATEGORY_LABELS: Record<NavCategory, string> = {
	trackers: 'Progress Trackers',
	documents: 'Documents',
	planners: 'Weekly Planners'
};

export function categoryHref(courseId: string, category: NavCategory): string {
	return category === 'trackers' ? `/c/${courseId}` : `/c/${courseId}/${category}`;
}

// Classifies an individually-opened page (routed at /c/{courseId}/{pageId},
// which carries no category info of its own) by looking up its type.
export function classifyPage(pages: Page[], pageId: string | undefined): NavCategory | null {
	if (!pageId) return null;
	const p = pages.find((pg) => pg.id === pageId);
	if (!p) return null;
	return TRACKER_TYPES.has(p.type) ? 'trackers' : 'documents';
}
