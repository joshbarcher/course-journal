import { error, json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { LecturePlanPatternBodySchema } from '$lib/schemas/api';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const body = await parseJsonBody(request, LecturePlanPatternBodySchema);
	const plan = await service.setMeetingDays(params.planId, body.days);
	if (!plan) return error(404, { message: 'Plan not found' });
	return json(LecturePlanSchema.parse(plan));
};
