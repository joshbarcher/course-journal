// Ported from src/tests/pageHelpers.test.js — minimal-churn port
// (node:test -> vitest), keeping the manual JSDOM + global.document setup
// verbatim rather than switching to Vitest's built-in jsdom environment.
import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html>');
const { document: doc } = dom.window;
(global as any).document = doc;
(global as any).window = dom.window;
(global as any).Node = dom.window.Node;

const { parseListItems, applyIndent, renderListItems } = await import('./page-helpers');

function ul(innerHtml: string) {
	const el = doc.createElement('ul');
	el.innerHTML = innerHtml;
	return el;
}

function ulFromText(texts: string[]) {
	const el = doc.createElement('ul');
	for (const t of texts) {
		const li = doc.createElement('li');
		li.textContent = t;
		el.appendChild(li);
	}
	return el;
}

// ── parseListItems ────────────────────────────────────────────────────────────

describe('parseListItems', () => {
	test('parses a single flat item', () => {
		assert.deepEqual(parseListItems(ul('<li>hello</li>')), [{ depth: 0, html: 'hello' }]);
	});

	test('parses multiple flat items', () => {
		assert.deepEqual(parseListItems(ul('<li>a</li><li>b</li>')), [
			{ depth: 0, html: 'a' },
			{ depth: 0, html: 'b' }
		]);
	});

	test('preserves safe inline HTML', () => {
		const items = parseListItems(ul('<li><b>bold</b> text</li>'));
		assert.equal(items.length, 1);
		assert.equal(items[0].html, '<b>bold</b> text');
	});

	test('entity-encodes HTML comment characters in text nodes', () => {
		const items = parseListItems(ulFromText(['<!-- comment -->']));
		assert.equal(items[0].html, '&lt;!-- comment --&gt;');
	});

	test('entity-encodes <img> characters in text nodes', () => {
		const items = parseListItems(ulFromText(['write <img src="x"> here']));
		assert.ok(!items[0].html.includes('<img'), 'raw <img> must not appear');
	});

	test('parses nested list into depth-tracked flat array', () => {
		assert.deepEqual(parseListItems(ul('<li>parent<ul><li>child</li></ul></li>')), [
			{ depth: 0, html: 'parent' },
			{ depth: 1, html: 'child' }
		]);
	});

	test('strips nested list from parent item html', () => {
		const items = parseListItems(ul('<li>outer<ul><li>inner</li></ul></li>'));
		assert.ok(!items[0].html.includes('inner'));
	});

	test('handles three levels of nesting', () => {
		assert.deepEqual(parseListItems(ul('<li>a<ul><li>b<ul><li>c</li></ul></li></ul></li>')), [
			{ depth: 0, html: 'a' },
			{ depth: 1, html: 'b' },
			{ depth: 2, html: 'c' }
		]);
	});

	test('round-trip: escaped comment survives parse → render unchanged', () => {
		const ulEl = doc.createElement('ul');
		ulEl.innerHTML = '<li>&lt;!-- answer --&gt;</li>';
		const items = parseListItems(ulEl);
		assert.equal(renderListItems(items, 'ul'), '<li>&lt;!-- answer --&gt;</li>');
	});
});

// ── applyIndent ───────────────────────────────────────────────────────────────

describe('applyIndent', () => {
	test('indent increases depth by 1', () => {
		assert.deepEqual(applyIndent([{ depth: 0, html: 'x' }], 0, 0, false), [{ depth: 1, html: 'x' }]);
	});

	test('outdent decreases depth by 1', () => {
		assert.deepEqual(applyIndent([{ depth: 1, html: 'x' }], 0, 0, true), [{ depth: 0, html: 'x' }]);
	});

	test('outdent clamps at depth 0', () => {
		assert.deepEqual(applyIndent([{ depth: 0, html: 'x' }], 0, 0, true), [{ depth: 0, html: 'x' }]);
	});

	test('only affects the selected range', () => {
		const items = [
			{ depth: 0, html: 'a' },
			{ depth: 0, html: 'b' },
			{ depth: 0, html: 'c' }
		];
		const result = applyIndent(items, 1, 1, false);
		assert.deepEqual(result, [
			{ depth: 0, html: 'a' },
			{ depth: 1, html: 'b' },
			{ depth: 0, html: 'c' }
		]);
	});

	test('does not mutate the original items array', () => {
		const items = [{ depth: 0, html: 'x' }];
		applyIndent(items, 0, 0, false);
		assert.equal(items[0].depth, 0);
	});

	test('affects a multi-item range', () => {
		const items = [
			{ depth: 0, html: 'a' },
			{ depth: 0, html: 'b' },
			{ depth: 0, html: 'c' }
		];
		const result = applyIndent(items, 0, 2, false);
		assert.ok(result.every((it) => it.depth === 1));
	});

	test('returns items unchanged for out-of-range startIdx', () => {
		const items = [{ depth: 0, html: 'x' }];
		assert.deepEqual(applyIndent(items, 5, 5, false), items);
	});
});

// ── renderListItems ───────────────────────────────────────────────────────────

describe('renderListItems', () => {
	test('renders empty items as empty string', () => {
		assert.equal(renderListItems([], 'ul'), '');
	});

	test('renders flat list', () => {
		const items = [
			{ depth: 0, html: 'a' },
			{ depth: 0, html: 'b' }
		];
		assert.equal(renderListItems(items, 'ul'), '<li>a</li><li>b</li>');
	});

	test('renders nested list', () => {
		const items = [
			{ depth: 0, html: 'parent' },
			{ depth: 1, html: 'child' }
		];
		assert.equal(renderListItems(items, 'ul'), '<li>parent<ul><li>child</li></ul></li>');
	});

	test('uses the provided tag for sub-lists', () => {
		const items = [
			{ depth: 0, html: 'a' },
			{ depth: 1, html: 'b' }
		];
		assert.ok(renderListItems(items, 'ol').includes('<ol>'));
	});

	test('Tab round-trip: HTML comment text preserved and escaped', () => {
		const ulEl = doc.createElement('ul');
		ulEl.innerHTML = '<li>first</li><li>&lt;!-- answer --&gt;</li>';
		const before = parseListItems(ulEl);
		const indented = applyIndent(before, 1, 1, false);
		const rendered = renderListItems(indented, 'ul');
		assert.ok(rendered.includes('&lt;!-- answer --&gt;'));
		assert.ok(!rendered.includes('<!--'));
	});

	test('Shift-Tab round-trip: HTML comment text preserved and escaped', () => {
		const ulEl = doc.createElement('ul');
		ulEl.innerHTML = '<li>first<ul><li>&lt;!-- note --&gt;</li></ul></li>';
		const before = parseListItems(ulEl);
		const outdented = applyIndent(before, 1, 1, true);
		const rendered = renderListItems(outdented, 'ul');
		assert.ok(rendered.includes('&lt;!-- note --&gt;'));
		assert.ok(!rendered.includes('<!--'));
	});
});
