import { z } from 'zod';
import { VALID_PAGE_TYPES } from './page';

// Request-body schemas for +server.ts handlers. These mirror the exact
// validation currently done by src/controllers/coursesController.js and
// pagesController.js (title required, type required + must be a known
// type) — kept deliberately permissive beyond that, since the merged
// result (existing record + patch) is what gets checked against the full
// PageSchema before writing (see server/persistence/journal-service.ts).

export const CreateCourseBodySchema = z.looseObject({
	title: z.string().min(1, 'title is required')
});

export const UpdateCourseBodySchema = z.looseObject({
	title: z.string().min(1, 'title is required')
});

export const CreatePageBodySchema = z.looseObject({
	type: z.enum(VALID_PAGE_TYPES, `type must be one of: ${VALID_PAGE_TYPES.join(', ')}`),
	title: z.string().min(1, 'title is required')
});

// A page update is an arbitrary partial patch — the server doesn't know the
// page's full shape until it loads the existing record and merges. Only the
// immutable keys are rejected here (matching JournalService.update()'s
// existing strip-on-write behavior); the merged result is what actually
// gets validated against PageSchema.
export const UpdatePageBodySchema = z
	.record(z.string(), z.unknown())
	.refine((body) => !('id' in body) && !('type' in body) && !('createdAt' in body), {
		message: 'id, type, and createdAt cannot be updated'
	});

export const ReorderBodySchema = z.looseObject({
	ids: z.array(z.string())
});
