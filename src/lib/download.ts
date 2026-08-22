// Browser-only helpers behind the Export menu. Kept out of export-page.ts
// so that module stays pure and DOM-free (it also runs on the server).

export function downloadText(filename: string, text: string, mime: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.rel = 'noopener';
	document.body.appendChild(link);
	link.click();
	link.remove();
	// Revoking synchronously can cancel the download before the browser has
	// finished reading the blob — hand it back on the next task instead.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyText(text: string): Promise<void> {
	// navigator.clipboard only exists in a secure context, and this app is
	// served over plain http on the LAN — so the textarea path below isn't a
	// legacy nicety, it's the one that actually runs in production.
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			/* fall through */
		}
	}

	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	// Off-screen, but still selectable — display:none or visibility:hidden
	// would make the selection, and therefore the copy, silently fail.
	area.style.position = 'fixed';
	area.style.top = '-1000px';
	area.style.opacity = '0';
	document.body.appendChild(area);

	// Every page in this app is full of contentEditable surfaces, so
	// clobbering the caret/selection to run a copy would be very visible.
	const selection = document.getSelection();
	const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

	let copied = false;
	try {
		area.select();
		copied = document.execCommand('copy');
	} finally {
		area.remove();
		if (selection && previous) {
			selection.removeAllRanges();
			selection.addRange(previous);
		}
	}

	if (!copied) throw new Error('the browser blocked the copy');
}
