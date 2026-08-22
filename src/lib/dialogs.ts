// Ported from public/js/dialog.js. Svelte 5's mount()/unmount() preserves
// the exact `await inputDialog(...)` ergonomic the old code had: mount a
// component into a portal div appended to document.body, resolve the
// promise when the component calls back, then unmount + remove the portal.
import { mount, unmount, type Component } from 'svelte';
import InputDialog from './components/InputDialog.svelte';
import ConfirmDialog from './components/ConfirmDialog.svelte';
import NewPageDialog from './components/NewPageDialog.svelte';
import type { PageType } from './schemas/page';

function mountDialog<Props extends Record<string, unknown>>(Component: Component<Props>, props: Props): () => void {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(Component, { target, props });
	return () => {
		unmount(instance);
		target.remove();
	};
}

export function inputDialog(title: string, placeholder = '', defaultValue = ''): Promise<string | null> {
	return new Promise((resolve) => {
		const cleanup = mountDialog(InputDialog, {
			title,
			placeholder,
			defaultValue,
			onResolve: (result: string | null) => {
				cleanup();
				resolve(result);
			}
		});
	});
}

export function confirmDialog(title: string, body: string, confirmLabel = 'Confirm'): Promise<boolean> {
	return new Promise((resolve) => {
		const cleanup = mountDialog(ConfirmDialog, {
			title,
			body,
			confirmLabel,
			onResolve: (result: boolean) => {
				cleanup();
				resolve(result);
			}
		});
	});
}

export function newPageDialog(
	options: { dialogTitle?: string; allowedTypes?: PageType[] } = {}
): Promise<{ title: string; type: PageType } | null> {
	return new Promise((resolve) => {
		const cleanup = mountDialog(NewPageDialog, {
			...options,
			onResolve: (result: { title: string; type: PageType } | null) => {
				cleanup();
				resolve(result);
			}
		});
	});
}

// Ported from public/js/dialog.js's error toast, with the variant and the
// dwell time factored out so a success message ("Copied as markdown") can
// reuse the same element and animation without pretending to be an error.
function toast(message: string, variant: 'error' | 'info', durationMs: number): void {
	const el = document.createElement('div');
	el.className = `toast toast--${variant}`;
	el.textContent = message;
	document.body.appendChild(el);
	requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--show')));
	setTimeout(() => {
		el.classList.remove('toast--show');
		setTimeout(() => el.remove(), 350);
	}, durationMs);
}

export function showError(message: string): void {
	toast(message, 'error', 4000);
}

// A confirmation of something that already worked — gone twice as fast as an
// error, since there's nothing here the user has to read and act on.
export function showToast(message: string): void {
	toast(message, 'info', 2000);
}
