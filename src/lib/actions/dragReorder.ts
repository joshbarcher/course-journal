// Shared native-HTML5-DnD reordering action, replacing the 6 near-identical
// copy-pasted drag/drop blocks in the old app (sidebar items, list items,
// list subtasks, progress tasks, progress-bars bars, progress-bars chips).
//
// Usage: apply to each draggable row/chip element within a list.
//   let dragState = $state<DragReorderState>({ draggingId: null, dragOverId: null });
//   <div use:dragReorder={{
//     id: item.id,
//     getState: () => dragState,
//     setState: (s) => (dragState = s),
//     onDrop: (draggedId, targetId) => { ...reorder... }
//   }} class:dragging={dragState.draggingId === item.id} class:drag-over={dragState.dragOverId === item.id}>
//
// The action only tracks drag/hover state and fires onDrop(draggedId,
// targetId) — it has no opinion on what "reorder" means, so it works for
// same-list reordering (splice items) and cross-container moves (e.g. list
// subtask chips moving between items) equally well.
export interface DragReorderState {
	draggingId: string | null;
	dragOverId: string | null;
}

export interface DragReorderParams {
	id: string;
	getState: () => DragReorderState;
	setState: (state: DragReorderState) => void;
	onDrop: (draggedId: string, targetId: string) => void;
}

export function dragReorder(node: HTMLElement, params: DragReorderParams) {
	let p = params;
	node.draggable = true;

	function onDragStart(e: DragEvent) {
		e.stopPropagation();
		p.setState({ draggingId: p.id, dragOverId: null });
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragEnd() {
		p.setState({ draggingId: null, dragOverId: null });
	}

	function onDragOver(e: DragEvent) {
		const state = p.getState();
		if (!state.draggingId || state.draggingId === p.id) return;
		e.preventDefault();
		e.stopPropagation();
		if (state.dragOverId !== p.id) p.setState({ ...state, dragOverId: p.id });
	}

	function onDragLeave() {
		const state = p.getState();
		if (state.dragOverId === p.id) p.setState({ ...state, dragOverId: null });
	}

	function onDrop(e: DragEvent) {
		const state = p.getState();
		if (!state.draggingId) return;
		e.preventDefault();
		e.stopPropagation();
		const draggedId = state.draggingId;
		p.setState({ draggingId: null, dragOverId: null });
		if (draggedId !== p.id) p.onDrop(draggedId, p.id);
	}

	node.addEventListener('dragstart', onDragStart);
	node.addEventListener('dragend', onDragEnd);
	node.addEventListener('dragover', onDragOver);
	node.addEventListener('dragleave', onDragLeave);
	node.addEventListener('drop', onDrop);

	return {
		update(newParams: DragReorderParams) {
			p = newParams;
		},
		destroy() {
			node.removeEventListener('dragstart', onDragStart);
			node.removeEventListener('dragend', onDragEnd);
			node.removeEventListener('dragover', onDragOver);
			node.removeEventListener('dragleave', onDragLeave);
			node.removeEventListener('drop', onDrop);
		}
	};
}

// Split variant of the action above, for cases where the whole draggable
// element can't itself be `draggable=true` — e.g. a card containing a
// <textarea>/<select>: wrapping the whole card in draggable=true breaks
// native text selection and opening the select, since a mousedown-drag
// inside them can be captured by the browser's own drag-start handling
// instead of their normal interaction. `dragHandle` goes on a small dedicated
// handle element (only it becomes draggable); `dropTarget` goes on the
// card itself so dropping/hovering still works anywhere on the card, not
// just over the tiny handle.
export interface DragHandleParams {
	id: string;
	getState: () => DragReorderState;
	setState: (state: DragReorderState) => void;
}

export function dragHandle(node: HTMLElement, params: DragHandleParams) {
	let p = params;
	node.draggable = true;

	function onDragStart(e: DragEvent) {
		e.stopPropagation();
		p.setState({ draggingId: p.id, dragOverId: null });
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragEnd() {
		p.setState({ draggingId: null, dragOverId: null });
	}

	node.addEventListener('dragstart', onDragStart);
	node.addEventListener('dragend', onDragEnd);

	return {
		update(newParams: DragHandleParams) {
			p = newParams;
		},
		destroy() {
			node.removeEventListener('dragstart', onDragStart);
			node.removeEventListener('dragend', onDragEnd);
		}
	};
}

export interface DropTargetParams {
	id: string;
	getState: () => DragReorderState;
	setState: (state: DragReorderState) => void;
	onDrop: (draggedId: string, targetId: string) => void;
}

export function dropTarget(node: HTMLElement, params: DropTargetParams) {
	let p = params;

	function onDragOver(e: DragEvent) {
		const state = p.getState();
		if (!state.draggingId || state.draggingId === p.id) return;
		e.preventDefault();
		e.stopPropagation();
		if (state.dragOverId !== p.id) p.setState({ ...state, dragOverId: p.id });
	}

	function onDragLeave() {
		const state = p.getState();
		if (state.dragOverId === p.id) p.setState({ ...state, dragOverId: null });
	}

	function onDrop(e: DragEvent) {
		const state = p.getState();
		if (!state.draggingId) return;
		e.preventDefault();
		e.stopPropagation();
		const draggedId = state.draggingId;
		p.setState({ draggingId: null, dragOverId: null });
		if (draggedId !== p.id) p.onDrop(draggedId, p.id);
	}

	node.addEventListener('dragover', onDragOver);
	node.addEventListener('dragleave', onDragLeave);
	node.addEventListener('drop', onDrop);

	return {
		update(newParams: DropTargetParams) {
			p = newParams;
		},
		destroy() {
			node.removeEventListener('dragover', onDragOver);
			node.removeEventListener('dragleave', onDragLeave);
			node.removeEventListener('drop', onDrop);
		}
	};
}

// Convenience helper for the common "reorder within one array" case: given
// the displayed order and a dragged/target id pair, returns a new array
// with the dragged item moved to the target's position.
export function reorderById<T>(items: T[], getId: (item: T) => string, draggedId: string, targetId: string): T[] {
	const fromIdx = items.findIndex((i) => getId(i) === draggedId);
	const toIdx = items.findIndex((i) => getId(i) === targetId);
	if (fromIdx === -1 || toIdx === -1) return items;
	const next = [...items];
	const [moved] = next.splice(fromIdx, 1);
	next.splice(toIdx, 0, moved);
	return next;
}
