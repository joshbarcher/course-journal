import { error, json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreateLectureWeekBodySchema } from '$lib/schemas/api';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const body = await parseJsonBody(request, CreateLectureWeekBodySchema);
	const plan = await service.addWeek(params.planId, body.id);
	if (!plan) return error(404, { message: 'Plan not found' });
	return json(LecturePlanSchema.parse(plan), { status: 201 });
};
