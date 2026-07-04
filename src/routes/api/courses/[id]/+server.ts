import { error, json } from '@sveltejs/kit';
import { getCourseService } from '$lib/server/persistence/course-service';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { UpdateCourseBodySchema } from '$lib/schemas/api';
import { CourseSchema } from '$lib/schemas/course';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const course = getCourseService().getById(params.id);
	if (!course) return error(404, { message: 'Course not found' });
	return json(CourseSchema.parse(course));
};

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const body = await parseJsonBody(request, UpdateCourseBodySchema);
	const course = await getCourseService().update(params.id, { title: body.title });
	if (!course) return error(404, { message: 'Course not found' });
	return json(CourseSchema.parse(course));
};

export const DELETE: RequestHandler = async ({ params }) => {
	assertWritable();
	const removed = await getCourseService().remove(params.id);
	if (!removed) return error(404, { message: 'Course not found' });
	return new Response(null, { status: 204 });
};
