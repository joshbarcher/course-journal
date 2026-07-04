import { error, json } from '@sveltejs/kit';
import { resolveJournal } from '$lib/server/resolve-course';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { UpdatePageBodySchema } from '$lib/schemas/api';
import { PageSchema } from '$lib/schemas/page';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const journal = resolveJournal(params.id);
	const page = journal.getById(params.pageId);
	if (!page) return error(404, { message: 'Page not found' });
	return json(PageSchema.parse(page));
};

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const journal = resolveJournal(params.id);
	const existing = journal.getById(params.pageId);
	if (!existing) return error(404, { message: 'Page not found' });

	const patch = await parseJsonBody(request, UpdatePageBodySchema);

	// The client doesn't know the page's full shape ahead of time, so the
	// patch itself is validated only permissively above. Real safety comes
	// from checking the merged result against the full page schema before
	// it's ever written to disk.
	const merged = PageSchema.safeParse({ ...existing, ...patch });
	if (!merged.success) {
		return error(400, { message: merged.error.issues.map((i) => i.message).join('; ') });
	}

	const updated = await journal.update(params.pageId, patch);
	if (!updated) return error(404, { message: 'Page not found' });
	return json(PageSchema.parse(updated));
};

export const DELETE: RequestHandler = async ({ params }) => {
	assertWritable();
	const journal = resolveJournal(params.id);
	const removed = await journal.remove(params.pageId);
	if (!removed) return error(404, { message: 'Page not found' });
	return new Response(null, { status: 204 });
};
