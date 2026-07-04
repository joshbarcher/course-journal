import { error, json } from '@sveltejs/kit';
import { getCourseService } from '$lib/server/persistence/course-service';
import { assertWritable } from '$lib/server/assert-writable';
import { CourseSchema } from '$lib/schemas/course';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	assertWritable();
	const course = await getCourseService().copy(params.id);
	if (!course) return error(404, { message: 'Course not found' });
	return json(CourseSchema.parse(course), { status: 201 });
};
