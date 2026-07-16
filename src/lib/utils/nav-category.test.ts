// Tests (new) for nav-category.ts — the shared Sidebar/Breadcrumbs
// classifier. Adversarial focus: unknown/missing page ids, category href
// special-casing of 'trackers', and every page-type -> category mapping.
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { categoryHref, classifyPage, NAV_CATEGORY_LABELS } from './nav-category';
import type { Page } from '$lib/schemas/page';

function page(id: string, type: string): Page {
	return { id, type, title: id } as unknown as Page;
}

describe('categoryHref', () => {
	it('routes trackers to the course root (no /trackers segment)', () => {
		assert.equal(categoryHref('c1', 'trackers'), '/c/c1');
	});
	it('routes documents and planners to their named subpaths', () => {
		assert.equal(categoryHref('c1', 'documents'), '/c/c1/documents');
		assert.equal(categoryHref('c1', 'planners'), '/c/c1/planners');
	});
	it('does not mangle a courseId containing url-ish characters', () => {
		assert.equal(categoryHref('a b/c', 'documents'), '/c/a b/c/documents');
	});
});

describe('classifyPage', () => {
	const pages = [
		page('prog', 'progress'),
		page('bars', 'progress-bars'),
		page('lst', 'list'),
		page('nts', 'notes'),
		page('pg', 'page')
	];

	it('classifies progress / progress-bars / list as trackers', () => {
		assert.equal(classifyPage(pages, 'prog'), 'trackers');
		assert.equal(classifyPage(pages, 'bars'), 'trackers');
		assert.equal(classifyPage(pages, 'lst'), 'trackers');
	});

	it('classifies notes and rich-text pages as documents', () => {
		assert.equal(classifyPage(pages, 'nts'), 'documents');
		assert.equal(classifyPage(pages, 'pg'), 'documents');
	});

	it('returns null for an undefined pageId', () => {
		assert.equal(classifyPage(pages, undefined), null);
	});

	it('returns null for an empty-string pageId', () => {
		assert.equal(classifyPage(pages, ''), null);
	});

	it('returns null when the pageId is not in the list', () => {
		assert.equal(classifyPage(pages, 'ghost'), null);
	});

	it('never throws on an empty pages array', () => {
		assert.equal(classifyPage([], 'anything'), null);
	});
});

describe('NAV_CATEGORY_LABELS', () => {
	it('has a human label for every category', () => {
		assert.equal(NAV_CATEGORY_LABELS.trackers, 'Progress Trackers');
		assert.equal(NAV_CATEGORY_LABELS.documents, 'Documents');
		assert.equal(NAV_CATEGORY_LABELS.planners, 'Weekly Planners');
	});
});
