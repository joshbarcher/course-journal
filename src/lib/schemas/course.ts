import { z } from 'zod';

export const CourseSchema = z.looseObject({
	id: z.string(),
	title: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
});
export type Course = z.infer<typeof CourseSchema>;

export const CoursesFileSchema = z.looseObject({
	courses: z.array(CourseSchema)
});
export type CoursesFile = z.infer<typeof CoursesFileSchema>;
