import { resolveJournal } from '$lib/server/resolve-course';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const journal = resolveJournal(params.courseId);
	// A missing page returns { page: null } rather than a hard 404 — the
	// component shows an in-app "not found" message, matching the old
	// router's behavior of never crashing the whole app shell over one
	// missing page id.
	const page = journal.getById(params.pageId);
	return { courseId: params.courseId, page };
};
