import { error } from '@sveltejs/kit';
import { resolveJournal } from '$lib/server/resolve-course';
import { exportResponse } from '$lib/server/export-response';
import { PageSchema } from '$lib/schemas/page';
import type { RequestHandler } from './$types';

// GET /api/courses/:id/pages/:pageId/export?format=md|txt[&download=0]
//
// A stable URL for one page's contents as text — the same bytes the in-app
// "Download .md" menu produces, but fetchable by anything that speaks HTTP.
export const GET: RequestHandler = async ({ params, url }) => {
	const journal = resolveJournal(params.id);
	const page = journal.getById(params.pageId);
	if (!page) return error(404, { message: 'Page not found' });
	return exportResponse(PageSchema.parse(page), url);
};
