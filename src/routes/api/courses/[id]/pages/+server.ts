import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveJournal } from '$lib/server/resolve-course';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreatePageBodySchema } from '$lib/schemas/api';
import { PageSchema } from '$lib/schemas/page';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const journal = resolveJournal(params.id);
	return json(z.array(PageSchema).parse(journal.getAll()));
};

export const POST: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const journal = resolveJournal(params.id);
	const body = await parseJsonBody(request, CreatePageBodySchema);
	const page = await journal.create(body);
	return json(PageSchema.parse(page), { status: 201 });
};
