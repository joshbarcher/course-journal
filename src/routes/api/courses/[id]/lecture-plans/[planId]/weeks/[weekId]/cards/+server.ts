import { error, json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreateLectureCardBodySchema } from '$lib/schemas/api';
import { LectureCardSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const body = await parseJsonBody(request, CreateLectureCardBodySchema);
	const card = await service.addCard(params.planId, params.weekId, body);
	if (!card) return error(404, { message: 'Plan or week not found' });
	return json(LectureCardSchema.parse(card), { status: 201 });
};
