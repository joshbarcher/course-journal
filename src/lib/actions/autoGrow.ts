// Auto-sizes a <textarea> to fit its content, so a freshly loaded page shows
// multi-line text in full immediately instead of clipping it to the CSS
// min-height until the user manually resizes or scrolls.
export function autoGrow(node: HTMLTextAreaElement) {
	function resize() {
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	}

	resize();
	node.addEventListener('input', resize);

	return {
		destroy() {
			node.removeEventListener('input', resize);
		}
	};
}
