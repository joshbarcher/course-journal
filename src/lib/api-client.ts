// Thin fetch wrapper used by client-side components to persist changes.
// Replaces the old public/js/api.js — since routes carry courseId directly
// via SvelteKit params/props now, there's no need for the old
// course-context.js singleton-active-course indirection.
import type { Course } from '$lib/schemas/course';
import type { Page, PageType } from '$lib/schemas/page';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(path, {
		method,
		headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	if (res.status === 204) return null as T;
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
	return data as T;
}

// ── Pages ─────────────────────────────────────────────────────────────────

export async function updatePage(courseId: string, pageId: string, patch: Record<string, unknown>): Promise<Page> {
	return request<Page>('PUT', `/api/courses/${courseId}/pages/${pageId}`, patch);
}

export async function createPage(
	courseId: string,
	data: { type: PageType; title: string } & Record<string, unknown>
): Promise<Page> {
	return request<Page>('POST', `/api/courses/${courseId}/pages`, data);
}

export async function removePage(courseId: string, pageId: string): Promise<void> {
	await request<void>('DELETE', `/api/courses/${courseId}/pages/${pageId}`);
}

export async function reorderPages(courseId: string, ids: string[]): Promise<void> {
	await request<{ ok: true }>('PUT', `/api/courses/${courseId}/pages/order`, { ids });
}

// ── Courses ───────────────────────────────────────────────────────────────

export async function listCourses(): Promise<Course[]> {
	return request<Course[]>('GET', '/api/courses');
}

export async function createCourse(title: string): Promise<Course> {
	return request<Course>('POST', '/api/courses', { title });
}

export async function updateCourse(id: string, title: string): Promise<Course> {
	return request<Course>('PUT', `/api/courses/${id}`, { title });
}

export async function removeCourse(id: string): Promise<void> {
	await request<void>('DELETE', `/api/courses/${id}`);
}

export async function copyCourse(id: string): Promise<Course> {
	return request<Course>('POST', `/api/courses/${id}/copy`);
}
