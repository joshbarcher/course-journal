import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCourseService } from '$lib/server/persistence/course-service';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { CreateCourseBodySchema } from '$lib/schemas/api';
import { CourseSchema } from '$lib/schemas/course';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const courses = getCourseService().getAll();
	return json(z.array(CourseSchema).parse(courses));
};

export const POST: RequestHandler = async ({ request }) => {
	assertWritable();
	const body = await parseJsonBody(request, CreateCourseBodySchema);
	const course = await getCourseService().create({ title: body.title });
	return json(CourseSchema.parse(course), { status: 201 });
};
