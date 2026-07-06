import { error, json } from '@sveltejs/kit';
import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { MoveLectureCardBodySchema } from '$lib/schemas/api';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlan(params.id);
	const body = await parseJsonBody(request, MoveLectureCardBodySchema);
	const moved = await service.moveCard(params.cardId, {
		weekId: body.targetWeekId,
		day: body.targetDay,
		beforeCardId: body.targetCardId
	});
	if (!moved) return error(404, { message: 'Card or target week not found' });
	return json({ ok: true });
};
