import { json } from '@sveltejs/kit';
import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreateLectureWeekBodySchema } from '$lib/schemas/api';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlan(params.id);
	const body = await parseJsonBody(request, CreateLectureWeekBodySchema);
	const plan = await service.addWeek(body.id);
	return json(LecturePlanSchema.parse(plan), { status: 201 });
};
