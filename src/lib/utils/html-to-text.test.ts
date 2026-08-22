import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
	decodeEntities,
	escapeMarkdown,
	htmlToMarkdown,
	htmlToPlainText,
	parseHtml
} from './html-to-text';

describe('decodeEntities', () => {
	it('decodes the named entities an editor actually emits', () => {
		assert.equal(decodeEntities('a &amp; b &lt; c &gt; d'), 'a & b < c > d');
		assert.equal(decodeEntities('&quot;x&quot; &apos;y&apos;'), '"x" \'y\'');
	});
	it('decodes decimal and hex numeric references', () => {
		assert.equal(decodeEntities('&#65;&#x42;&#X43;'), 'ABC');
	});
	it('leaves an unknown entity as literal text', () => {
		assert.equal(decodeEntities('&notarealentity; &amp'), '&notarealentity; &amp');
	});
	it('leaves an out-of-range or surrogate code point alone rather than throwing', () => {
		assert.equal(decodeEntities('&#xD800;'), '&#xD800;');
		assert.equal(decodeEntities('&#99999999;'), '&#99999999;');
	});
});

describe('escapeMarkdown', () => {
	it('escapes inline characters that would otherwise become markup', () => {
		assert.equal(escapeMarkdown('a * b [c] `d` <e>'), 'a \\* b \\[c\\] \\`d\\` \\<e>');
	});
	it('protects a generic type from being swallowed as an HTML tag', () => {
		assert.equal(escapeMarkdown('List<String> map'), 'List\\<String> map');
	});
	it('leaves intraword underscores alone but escapes emphasis-forming ones', () => {
		assert.equal(escapeMarkdown('snake_case_name'), 'snake_case_name');
		assert.equal(escapeMarkdown('_emphasis_'), '\\_emphasis\\_');
	});
	it('leaves hand-typed bullets, headings and quotes as real markdown', () => {
		assert.equal(escapeMarkdown('- item'), '- item');
		assert.equal(escapeMarkdown('# heading'), '# heading');
		assert.equal(escapeMarkdown('1. one'), '1. one');
		assert.equal(escapeMarkdown('> quote'), '> quote');
	});
	it('leaves text with no special characters untouched', () => {
		assert.equal(escapeMarkdown('a - b (c) 50%'), 'a - b (c) 50%');
	});
});

describe('parseHtml', () => {
	it('nests elements and keeps attributes', () => {
		const [node] = parseHtml('<a href="https://x.test" title=hi>link</a>');
		assert.equal(node.type, 'element');
		assert.deepEqual(node.type === 'element' && node.attrs, { href: 'https://x.test', title: 'hi' });
	});
	it('treats a void tag as childless without unbalancing the stack', () => {
		const nodes = parseHtml('<div>a<br>b</div>');
		assert.equal(nodes.length, 1);
		assert.equal(nodes[0].type === 'element' && nodes[0].children.length, 3);
	});
	it('drops a close tag that matches nothing open', () => {
		assert.deepEqual(parseHtml('a</b>b'), [
			{ type: 'text', text: 'a' },
			{ type: 'text', text: 'b' }
		]);
	});
	it('ignores comments', () => {
		assert.deepEqual(parseHtml('a<!-- note -->b'), [
			{ type: 'text', text: 'a' },
			{ type: 'text', text: 'b' }
		]);
	});
});

describe('htmlToMarkdown — line structure', () => {
	it('returns an empty string for empty input', () => {
		assert.equal(htmlToMarkdown(''), '');
		assert.equal(htmlToPlainText(''), '');
	});
	it('renders the editor\'s per-line <div>s as single newlines, not blank lines', () => {
		assert.equal(htmlToMarkdown('<div>Hello</div><div>World</div>'), 'Hello\nWorld');
	});
	it('renders <br> as a newline', () => {
		assert.equal(htmlToMarkdown('<div>a<br>b</div>'), 'a\nb');
	});
	it('separates <p> blocks with a blank line', () => {
		assert.equal(htmlToMarkdown('<p>a</p><p>b</p>'), 'a\n\nb');
	});
	it('collapses whitespace and newlines inside text the way a browser would', () => {
		assert.equal(htmlToMarkdown('<div>a   b\n\tc</div>'), 'a b c');
	});
	it('turns &nbsp; padding into ordinary spaces', () => {
		assert.equal(htmlToMarkdown('<div>a&nbsp;&nbsp;b</div>'), 'a b');
	});
	it('never emits more than one blank line in a row', () => {
		assert.equal(htmlToMarkdown('<p>a</p><div><br></div><div><br></div><p>b</p>'), 'a\n\nb');
	});
});

describe('htmlToMarkdown — inline formatting', () => {
	it('converts bold, italic and strikethrough', () => {
		assert.equal(htmlToMarkdown('<b>a</b> <i>b</i> <s>c</s>'), '**a** *b* ~~c~~');
		assert.equal(htmlToMarkdown('<strong>a</strong> <em>b</em> <del>c</del>'), '**a** *b* ~~c~~');
	});
	it('moves surrounding spaces outside the emphasis markers', () => {
		assert.equal(htmlToMarkdown('<div>x<b> bold </b>y</div>'), 'x **bold** y');
	});
	it('drops an emphasis wrapper with no text in it', () => {
		assert.equal(htmlToMarkdown('<div>a<b> </b>b</div>'), 'a b');
	});
	it('drops presentation-only wrappers (u/font/span) but keeps their text', () => {
		assert.equal(htmlToMarkdown('<u>a</u> <font size="5" face="Georgia">b</font> <span style="color:red">c</span>'), 'a b c');
	});
	it('escapes text that would otherwise be read as markup', () => {
		assert.equal(htmlToMarkdown('<div>2 * 3 [x]</div>'), '2 \\* 3 \\[x\\]');
	});
	it('keeps a hand-typed dash line as a real bullet rather than escaping it', () => {
		// The rich-text pages in this app are full of manually typed "- " lines;
		// they're meant as bullets, so the export should read as bullets.
		assert.equal(
			htmlToMarkdown('<div>Slides</div><div>- what are package managers?</div>'),
			'Slides\n- what are package managers?'
		);
	});
	it('does not escape anything in the plain-text rendering', () => {
		assert.equal(htmlToPlainText('<div>2 * 3 [x]</div>'), '2 * 3 [x]');
		assert.equal(htmlToPlainText('<b>bold</b> <i>italic</i>'), 'bold italic');
	});
});

describe('htmlToMarkdown — lists', () => {
	it('renders an unordered list', () => {
		assert.equal(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>'), '- one\n- two');
	});
	it('numbers an ordered list, honouring start', () => {
		assert.equal(htmlToMarkdown('<ol><li>a</li><li>b</li></ol>'), '1. a\n2. b');
		assert.equal(htmlToMarkdown('<ol start="3"><li>a</li><li>b</li></ol>'), '3. a\n4. b');
	});
	it('indents a nested list under its parent item with no blank line between', () => {
		assert.equal(
			htmlToMarkdown('<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul>'),
			'- one\n- two\n  - nested'
		);
	});
	it('restarts numbering for each list rather than continuing across them', () => {
		assert.equal(htmlToMarkdown('<ol><li>a</li></ol><ol><li>b</li></ol>'), '1. a\n\n1. b');
	});
	it('closes an unclosed <li> at the next one', () => {
		assert.equal(htmlToMarkdown('<ul><li>a<li>b</ul>'), '- a\n- b');
	});
	it('does not let a nested <li> close the item that owns the nested list', () => {
		assert.equal(htmlToMarkdown('<ul><li>a<ul><li>b<li>c</ul></ul>'), '- a\n  - b\n  - c');
	});
	it('separates a top-level list from surrounding text with a blank line', () => {
		assert.equal(htmlToMarkdown('<div>before</div><ul><li>a</li></ul><div>after</div>'), 'before\n\n- a\n\nafter');
	});
	it('renders list markers in plain text too', () => {
		assert.equal(htmlToPlainText('<ul><li>a</li><li>b</li></ul>'), '- a\n- b');
	});
});

describe('htmlToMarkdown — blocks', () => {
	it('converts headings by level, and drops the hashes in plain text', () => {
		assert.equal(htmlToMarkdown('<h1>One</h1><h3>Three</h3>'), '# One\n\n### Three');
		assert.equal(htmlToPlainText('<h1>One</h1><h3>Three</h3>'), 'One\n\nThree');
	});
	it('prefixes every line of a blockquote', () => {
		assert.equal(htmlToMarkdown('<blockquote>a<br>b</blockquote>'), '> a\n> b');
	});
	it('fences a <pre> block and keeps its newlines verbatim', () => {
		assert.equal(htmlToMarkdown('<pre>let x = 1;\nlet y = 2;</pre>'), '```\nlet x = 1;\nlet y = 2;\n```');
	});
	it('does not escape markdown characters inside code', () => {
		assert.equal(htmlToMarkdown('<code>a*b</code>'), '`a*b`');
		assert.equal(htmlToPlainText('<code>a*b</code>'), 'a*b');
	});
	it('renders a horizontal rule', () => {
		assert.equal(htmlToMarkdown('<div>a</div><hr><div>b</div>'), 'a\n\n---\n\nb');
	});
});

describe('htmlToMarkdown — links, images and tables', () => {
	it('converts a link', () => {
		assert.equal(htmlToMarkdown('<a href="https://x.test">site</a>'), '[site](https://x.test)');
		assert.equal(htmlToPlainText('<a href="https://x.test">site</a>'), 'site (https://x.test)');
	});
	it('angle-brackets a destination containing spaces', () => {
		assert.equal(htmlToMarkdown('<a href="/a b">x</a>'), '[x](</a b>)');
	});
	it('falls back to the href when the link has no text', () => {
		assert.equal(htmlToMarkdown('<a href="https://x.test"></a>'), '[https://x.test](https://x.test)');
		assert.equal(htmlToPlainText('<a href="https://x.test"></a>'), 'https://x.test');
	});
	it('keeps a link with no href as plain text', () => {
		assert.equal(htmlToMarkdown('<a>text</a>'), 'text');
	});
	it('names an embedded image instead of inlining its data URI', () => {
		assert.equal(htmlToMarkdown('<img src="data:image/png;base64,AAAA" alt="chart">'), '[image: chart]');
		assert.equal(htmlToMarkdown('<img src="/logo.png" alt="logo">'), '![logo](/logo.png)');
	});
	it('renders a table with a header delimiter row in markdown only', () => {
		const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
		assert.equal(htmlToMarkdown(html), '| A | B |\n| --- | --- |\n| 1 | 2 |');
		assert.equal(htmlToPlainText(html), '| A | B |\n| 1 | 2 |');
	});
	it('pads a short row so the table stays rectangular', () => {
		const html = '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></tbody></table>';
		assert.equal(htmlToMarkdown(html), '| a | b |\n| --- | --- |\n| c |  |');
	});
});

describe('htmlToMarkdown — malformed input', () => {
	it('renders an unclosed tag rather than losing its content', () => {
		assert.equal(htmlToMarkdown('<b>bold'), '**bold**');
		assert.equal(htmlToMarkdown('<div>a<div>b'), 'a\nb');
	});
	it('ignores a stray closing tag', () => {
		assert.equal(htmlToMarkdown('a</b>b'), 'ab');
	});
	it('drops script and style content entirely', () => {
		assert.equal(htmlToMarkdown('<style>.a{color:red}</style><div>text</div><script>alert(1)</script>'), 'text');
	});
	it('treats a bare < as text rather than a tag', () => {
		assert.equal(htmlToPlainText('<div>a < b</div>'), 'a < b');
	});
	it('handles a self-closing tag written with a slash', () => {
		assert.equal(htmlToMarkdown('<div>a<br/>b</div>'), 'a\nb');
	});
});
