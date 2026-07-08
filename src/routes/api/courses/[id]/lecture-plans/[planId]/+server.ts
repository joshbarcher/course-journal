import { error, json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { UpdateLecturePlanBodySchema } from '$lib/schemas/api';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const service = resolveLecturePlans(params.id);
	const plan = service.getById(params.planId);
	if (!plan) return error(404, { message: 'Plan not found' });
	return json(LecturePlanSchema.parse(plan));
};

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const body = await parseJsonBody(request, UpdateLecturePlanBodySchema);
	const updated = await service.rename(params.planId, body.title);
	if (!updated) return error(404, { message: 'Plan not found' });
	return json(LecturePlanSchema.parse(updated));
};

export const DELETE: RequestHandler = async ({ params }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const removed = await service.remove(params.planId);
	if (!removed) return error(404, { message: 'Plan not found' });
	return new Response(null, { status: 204 });
};
