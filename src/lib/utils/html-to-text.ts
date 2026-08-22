// Minimal, dependency-free HTML -> Markdown / plain-text converter.
//
// The only HTML this app ever stores is what RichTextPage.svelte's
// contentEditable + document.execCommand editor produces: <div>/<br> line
// breaks, <b>/<i>/<u>/<font>/<span> inline formatting, and <ul>/<ol>/<li>
// lists. Pasted markup never reaches storage either — +layout.svelte's
// global paste handler inserts clipboard content as plain text — but the
// PUT /pages/:id route accepts any `content` string, so this stays a
// general (if small) converter rather than an execCommand-shaped one.
//
// Hand-rolled rather than DOMParser-based so the identical code runs in the
// browser (client-side "Download .md"), in Node (the /export route), and
// under vitest's `environment: 'node'` — no jsdom, no DOM globals.

export type HtmlNode =
	| { type: 'text'; text: string }
	| { type: 'element'; tag: string; attrs: Record<string, string>; children: HtmlNode[] };

type ElementNode = Extract<HtmlNode, { type: 'element' }>;

// Line/block break sentinels. Emitting real newlines here would make "one
// <br> between two <div>s" indistinguishable from "a blank line here", so
// breaks are emitted as markers and collapsed once, at the end, by
// finalize() — a run of markers takes the strongest break in it.
const LINE = '\u0001';
const BLOCK = '\u0002';
// Absorbs whitespace before a run and *between* markers, but deliberately
// stops at the last marker: whatever follows it is the next line's own
// indentation (a nested list item), which has to survive.
const MARKER_RUN = /[ \t]*[\u0001\u0002](?:[ \t]*[\u0001\u0002])*/g;
const ANY_MARKER = /[\u0001\u0002]+/g;

const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

// Dropped whole, content included.
const SKIPPED_TAGS = new Set(['script', 'style', 'head', 'title', 'noscript', 'template']);

// Block containers with no formatting of their own — rendered as a plain
// line break around their contents, like the editor's per-line <div>s.
const LINE_BLOCK_TAGS = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'form']);

// Blocks that get a blank line around them.
const PARAGRAPH_TAGS = new Set(['p', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'address']);

// An opening tag that implicitly closes an already-open element: `<li>a<li>b`
// ends the first <li> at the second.
const IMPLICIT_CLOSERS: Record<string, Set<string>> = {
	li: new Set(['li']),
	p: new Set(['p']),
	td: new Set(['td', 'th']),
	th: new Set(['td', 'th']),
	tr: new Set(['tr', 'td', 'th'])
};

// Where that search stops — an <li> inside a nested <ul> must not close the
// <li> that owns the nested list.
const IMPLICIT_CLOSE_BOUNDARY = new Set([
	'ul',
	'ol',
	'table',
	'thead',
	'tbody',
	'tfoot',
	'blockquote',
	'div',
	'td',
	'th'
]);

const TOKEN_RE = /<!--[\s\S]*?-->|<\/\s*([a-zA-Z][^\s/>]*)[^>]*>|<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
const ATTR_RE = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00a0',
	ensp: ' ',
	emsp: ' ',
	thinsp: ' ',
	shy: '',
	ndash: '–',
	mdash: '—',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	hellip: '…',
	bull: '•',
	middot: '·',
	copy: '©',
	reg: '®',
	trade: '™',
	deg: '°',
	times: '×',
	divide: '÷',
	laquo: '«',
	raquo: '»'
};

export function decodeEntities(text: string): string {
	return text.replace(/&(#[Xx][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
		if (body[0] === '#') {
			const hex = body[1] === 'x' || body[1] === 'X';
			const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
			// Lone surrogates and out-of-range code points throw in
			// fromCodePoint — leave those as the literal source text.
			if (!Number.isFinite(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return match;
			return String.fromCodePoint(code);
		}
		return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

function isWordChar(ch: string | undefined): boolean {
	return ch !== undefined && /\w/.test(ch);
}

// Escapes what would otherwise silently change how a character renders:
// `List<String>` must not be swallowed as a raw HTML tag, and `[x]` must not
// become a link reference. `\x` renders as a plain `x`, so an unnecessary
// escape costs one backslash in the raw file, while a missing one loses the
// character outright.
//
// Two deliberate exceptions, both because these exports get read as text at
// least as often as they get rendered:
//
//   `_` between two word characters is left alone — CommonMark doesn't treat
//   intraword underscores as emphasis, and escaping them all would turn
//   ordinary snake_case into unreadable snake\_case.
//
//   Line-leading `-`, `#`, `>` and `1.` are left alone. People hand-type
//   those as bullets and headings in the rich-text editor (the real pages in
//   this app are full of them), so escaping would litter the export with
//   backslashes to defend a distinction the author never intended — and the
//   raw characters read the same either way.
export function escapeMarkdown(text: string): string {
	return text.replace(/[\\`*_[\]<]/g, (ch, offset: number) => {
		if (ch === '_' && isWordChar(text[offset - 1]) && isWordChar(text[offset + 1])) return ch;
		return '\\' + ch;
	});
}

function parseAttrs(raw: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	if (!raw.trim()) return attrs;
	ATTR_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = ATTR_RE.exec(raw))) {
		attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
	}
	return attrs;
}

function implicitClose(stack: ElementNode[], tag: string): void {
	const closers = IMPLICIT_CLOSERS[tag];
	if (!closers) return;
	// Takes the OUTERMOST match before the boundary, so a new `<tr>` closes
	// both the open <td> and the open <tr>, not just the <td>.
	let cut = -1;
	for (let i = stack.length - 1; i > 0; i--) {
		const open = stack[i].tag;
		if (closers.has(open)) cut = i;
		else if (IMPLICIT_CLOSE_BOUNDARY.has(open)) break;
	}
	if (cut !== -1) stack.length = cut;
}

export function parseHtml(html: string): HtmlNode[] {
	const root: ElementNode = { type: 'element', tag: '#root', attrs: {}, children: [] };
	const stack: ElementNode[] = [root];
	const pushText = (text: string) => {
		if (text) stack[stack.length - 1].children.push({ type: 'text', text });
	};

	let last = 0;
	TOKEN_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TOKEN_RE.exec(html))) {
		pushText(html.slice(last, m.index));
		last = TOKEN_RE.lastIndex;

		const [, closeTag, openTag, rawAttrs] = m;

		if (closeTag !== undefined) {
			const tag = closeTag.toLowerCase();
			for (let i = stack.length - 1; i > 0; i--) {
				if (stack[i].tag === tag) {
					stack.length = i;
					break;
				}
			}
			// A close tag matching nothing open is dropped rather than treated
			// as text — what every browser parser does with a stray `</b>`.
			continue;
		}
		if (openTag === undefined) continue; // comment

		const tag = openTag.toLowerCase();
		implicitClose(stack, tag);
		const node: ElementNode = { type: 'element', tag, attrs: parseAttrs(rawAttrs ?? ''), children: [] };
		stack[stack.length - 1].children.push(node);
		// A self-closing `<br/>` leaves a stray "/" in rawAttrs, which
		// parseAttrs ignores; void tags never go on the stack either way.
		if (!VOID_TAGS.has(tag)) stack.push(node);
	}
	pushText(html.slice(last));
	// Anything still open at EOF is simply left open — its children are
	// already attached to it, so no content is lost.
	return root.children;
}

interface RenderCtx {
	md: boolean;
	// One frame per enclosing <ul>/<ol>; `index` is the next <li> number.
	lists: { ordered: boolean; index: number }[];
	pre: boolean;
	// Inside <code>/<pre>, where Markdown escaping would be visible noise.
	raw: boolean;
}

function renderText(raw: string, ctx: RenderCtx): string {
	let text = decodeEntities(raw).replace(/\u00a0/g, ' ');
	// execCommand pads with &nbsp; and pretty-printed HTML carries newlines
	// that aren't line breaks — collapse both the way a browser would.
	if (!ctx.pre) text = text.replace(/\s+/g, ' ');
	if (!text) return '';
	return ctx.md && !ctx.raw ? escapeMarkdown(text) : text;
}

function renderChildren(nodes: HtmlNode[], ctx: RenderCtx): string {
	let out = '';
	for (const node of nodes) {
		out += node.type === 'text' ? renderText(node.text, ctx) : renderElement(node, ctx);
	}
	return out;
}

// Markdown emphasis delimiters can't touch whitespace (`** x **` renders
// literally), so any surrounding spaces move outside the markers.
function wrapInline(node: ElementNode, ctx: RenderCtx, marker: string): string {
	const inner = renderChildren(node.children, ctx);
	if (!marker) return inner;
	const [, lead, core, trail] = /^([ \t]*)([\s\S]*?)([ \t]*)$/.exec(inner) as RegExpExecArray;
	if (!core.trim()) return inner;
	return `${lead}${marker}${core}${marker}${trail}`;
}

function renderList(node: ElementNode, ctx: RenderCtx): string {
	const start = Number(node.attrs.start);
	ctx.lists.push({
		ordered: node.tag === 'ol',
		index: Number.isInteger(start) && start > 0 ? start : 1
	});
	const inner = renderChildren(node.children, ctx);
	ctx.lists.pop();
	// A nested list belongs to the line above it, so it only gets a line
	// break; a top-level list is a block of its own.
	const sep = ctx.lists.length ? LINE : BLOCK;
	return sep + inner + sep;
}

function renderListItem(node: ElementNode, ctx: RenderCtx): string {
	const frame = ctx.lists[ctx.lists.length - 1];
	const marker = frame ? (frame.ordered ? `${frame.index++}.` : '-') : '-';
	const indent = '  '.repeat(Math.max(0, ctx.lists.length - 1));
	// Trims spaces only — a nested list's leading marker has to survive.
	const inner = renderChildren(node.children, ctx).replace(/^[ \t]+|[ \t]+$/g, '');
	return `${LINE}${indent}${marker} ${inner}`;
}

function renderHeading(node: ElementNode, ctx: RenderCtx, level: number): string {
	const inner = renderChildren(node.children, ctx).replace(ANY_MARKER, ' ').trim();
	if (!inner) return '';
	return BLOCK + (ctx.md ? `${'#'.repeat(level)} ${inner}` : inner) + BLOCK;
}

function renderBlockquote(node: ElementNode, ctx: RenderCtx): string {
	const inner = renderChildren(node.children, ctx).replace(/^[\s\u0001\u0002]+|[\s\u0001\u0002]+$/g, '');
	if (!inner) return '';
	if (!ctx.md) return BLOCK + inner + BLOCK;
	return BLOCK + '> ' + inner.replace(ANY_MARKER, LINE + '> ') + BLOCK;
}

function renderPre(node: ElementNode, ctx: RenderCtx): string {
	const inner = renderChildren(node.children, { ...ctx, pre: true, raw: true }).replace(ANY_MARKER, '\n');
	const body = inner.replace(/^\n+|\n+$/g, '');
	if (!body) return '';
	return BLOCK + (ctx.md ? '```\n' + body + '\n```' : body) + BLOCK;
}

function renderLink(node: ElementNode, ctx: RenderCtx): string {
	const href = (node.attrs.href ?? '').trim();
	const inner = renderChildren(node.children, ctx);
	if (!href) return inner;
	if (ctx.md) {
		// A destination containing spaces or parens has to be angle-bracketed.
		const target = /[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, '')}>` : href;
		return `[${inner.trim() || escapeMarkdown(href)}](${target})`;
	}
	const label = inner.trim();
	return !label || label === href ? href : `${label} (${href})`;
}

function renderImage(node: ElementNode, ctx: RenderCtx): string {
	const src = (node.attrs.src ?? '').trim();
	const alt = (node.attrs.alt ?? '').trim();
	if (!src && !alt) return '';
	if (!ctx.md) return alt ? `[image: ${alt}]` : '[image]';
	// A data: URI here would be tens of kilobytes of base64 dropped into the
	// middle of a sentence — name the image instead of inlining it.
	const target = /^data:/i.test(src) ? '' : src;
	return target ? `![${escapeMarkdown(alt)}](${target})` : `[image: ${escapeMarkdown(alt) || 'embedded'}]`;
}

function collectRows(node: ElementNode, ctx: RenderCtx, rows: string[][]): void {
	for (const child of node.children) {
		if (child.type !== 'element') continue;
		if (child.tag === 'tr') {
			rows.push(
				child.children
					.filter((c): c is ElementNode => c.type === 'element' && (c.tag === 'td' || c.tag === 'th'))
					.map((cell) => {
						const text = renderChildren(cell.children, ctx).replace(ANY_MARKER, ' ').trim();
						return ctx.md ? text.replace(/\|/g, '\\|') : text;
					})
			);
		} else {
			collectRows(child, ctx, rows);
		}
	}
}

function renderTable(node: ElementNode, ctx: RenderCtx): string {
	const rows: string[][] = [];
	collectRows(node, ctx, rows);
	if (!rows.length) return '';
	const width = Math.max(...rows.map((r) => r.length));
	const row = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
	const lines = [row(rows[0])];
	// Markdown needs a delimiter row or the whole table renders as plain
	// text; the first row becomes the header, which is the common case.
	if (ctx.md) lines.push(`| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
	for (const cells of rows.slice(1)) lines.push(row(cells));
	return BLOCK + lines.join(LINE) + BLOCK;
}

function renderElement(node: ElementNode, ctx: RenderCtx): string {
	const tag = node.tag;
	if (SKIPPED_TAGS.has(tag)) return '';

	switch (tag) {
		case 'br':
			return LINE;
		case 'hr':
			return BLOCK + (ctx.md ? '---' : '-'.repeat(24)) + BLOCK;
		case 'img':
			return renderImage(node, ctx);
		case 'ul':
		case 'ol':
			return renderList(node, ctx);
		case 'li':
			return renderListItem(node, ctx);
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6':
			return renderHeading(node, ctx, Number(tag[1]));
		case 'blockquote':
			return renderBlockquote(node, ctx);
		case 'pre':
			return renderPre(node, ctx);
		case 'code':
		case 'kbd':
		case 'samp':
			return ctx.md
				? '`' + renderChildren(node.children, { ...ctx, raw: true }) + '`'
				: renderChildren(node.children, ctx);
		case 'a':
			return renderLink(node, ctx);
		case 'table':
			return renderTable(node, ctx);
		case 'b':
		case 'strong':
			return wrapInline(node, ctx, ctx.md ? '**' : '');
		case 'i':
		case 'em':
			return wrapInline(node, ctx, ctx.md ? '*' : '');
		case 's':
		case 'strike':
		case 'del':
			return wrapInline(node, ctx, ctx.md ? '~~' : '');
		default:
			// <u>, <font>, <span> and friends: Markdown has no underline and no
			// font/colour, and raw HTML in the output would be noise in a file
			// meant to be read and edited as text — the content passes through
			// and the presentation is dropped.
			if (LINE_BLOCK_TAGS.has(tag)) return LINE + renderChildren(node.children, ctx) + LINE;
			if (PARAGRAPH_TAGS.has(tag)) return BLOCK + renderChildren(node.children, ctx) + BLOCK;
			return renderChildren(node.children, ctx);
	}
}

function finalize(text: string): string {
	return text
		.replace(MARKER_RUN, (run) => (run.includes(BLOCK) ? '\n\n' : '\n'))
		.replace(/[ \t]+$/gm, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function convert(html: string, md: boolean): string {
	if (!html) return '';
	return finalize(renderChildren(parseHtml(html), { md, lists: [], pre: false, raw: false }));
}

export function htmlToMarkdown(html: string): string {
	return convert(html, true);
}

export function htmlToPlainText(html: string): string {
	return convert(html, false);
}
