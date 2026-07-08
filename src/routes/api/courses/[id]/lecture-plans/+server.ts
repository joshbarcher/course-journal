import { json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreateLecturePlanBodySchema } from '$lib/schemas/api';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import { z } from 'zod';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const service = resolveLecturePlans(params.id);
	return json(z.array(LecturePlanSchema).parse(service.getAll()));
};

export const POST: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const body = await parseJsonBody(request, CreateLecturePlanBodySchema);
	const plan = await service.create(body.title, body.id);
	return json(LecturePlanSchema.parse(plan), { status: 201 });
};
