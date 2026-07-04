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

export function newPageDialog(): Promise<{ title: string; type: PageType } | null> {
	return new Promise((resolve) => {
		const cleanup = mountDialog(NewPageDialog, {
			onResolve: (result: { title: string; type: PageType } | null) => {
				cleanup();
				resolve(result);
			}
		});
	});
}

export function showError(message: string): void {
	const el = document.createElement('div');
	el.className = 'error-toast';
	el.textContent = message;
	document.body.appendChild(el);
	requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('error-toast--show')));
	setTimeout(() => {
		el.classList.remove('error-toast--show');
		setTimeout(() => el.remove(), 350);
	}, 4000);
}
