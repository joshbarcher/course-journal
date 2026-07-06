import { error, json } from '@sveltejs/kit';
import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreateLectureCardBodySchema } from '$lib/schemas/api';
import { LectureCardSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlan(params.id);
	const body = await parseJsonBody(request, CreateLectureCardBodySchema);
	const card = await service.addCard(params.weekId, body);
	if (!card) return error(404, { message: 'Week not found' });
	return json(LectureCardSchema.parse(card), { status: 201 });
};
