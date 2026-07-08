import { error, json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { UpdateLectureCardBodySchema } from '$lib/schemas/api';
import { LectureCardSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const existing = service.getCard(params.planId, params.cardId);
	if (!existing) return error(404, { message: 'Card not found' });

	const patch = await parseJsonBody(request, UpdateLectureCardBodySchema);

	const merged = LectureCardSchema.safeParse({ ...existing.card, ...patch });
	if (!merged.success) {
		return error(400, { message: merged.error.issues.map((i) => i.message).join('; ') });
	}

	const updated = await service.updateCard(params.planId, params.cardId, patch);
	if (!updated) return error(404, { message: 'Card not found' });
	return json(LectureCardSchema.parse(updated));
};

export const DELETE: RequestHandler = async ({ params }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const removed = await service.removeCard(params.planId, params.cardId);
	if (!removed) return error(404, { message: 'Card not found' });
	return new Response(null, { status: 204 });
};
