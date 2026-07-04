import { json } from '@sveltejs/kit';
import { resolveJournal } from '$lib/server/resolve-course';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { ReorderBodySchema } from '$lib/schemas/api';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const journal = resolveJournal(params.id);
	const body = await parseJsonBody(request, ReorderBodySchema);
	await journal.reorder(body.ids);
	return json({ ok: true });
};
