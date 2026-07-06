import { json } from '@sveltejs/kit';
import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { LecturePlanPatternBodySchema } from '$lib/schemas/api';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlan(params.id);
	const body = await parseJsonBody(request, LecturePlanPatternBodySchema);
	const plan = await service.setMeetingDays(body.days);
	return json(LecturePlanSchema.parse(plan));
};
