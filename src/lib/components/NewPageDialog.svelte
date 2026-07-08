<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageType } from '$lib/schemas/page';

	let {
		onResolve,
		dialogTitle = 'New Page',
		allowedTypes
	}: {
		onResolve: (result: { title: string; type: PageType } | null) => void;
		dialogTitle?: string;
		// Restricts the type picker — e.g. the Trackers list only offers
		// progress/progress-bars/list, Documents only offers notes/page.
		// Defaults to all 5 for backward compatibility.
		allowedTypes?: PageType[];
	} = $props();

	const ALL_PAGE_TYPES: { value: PageType; label: string; desc: string }[] = [
		{ value: 'progress', label: 'Progress Tracker', desc: 'Tasks with Start / Working / Done states' },
		{ value: 'progress-bars', label: 'Multi-Bar Progress', desc: 'Multiple segmented progress bars' },
		{ value: 'list', label: 'List', desc: 'Ordered or unordered checklist' },
		{ value: 'notes', label: 'Notes', desc: 'Freeform notes collection' },
		{ value: 'page', label: 'Page', desc: 'Rich text content page' }
	];

	let PAGE_TYPES = $derived(allowedTypes ? ALL_PAGE_TYPES.filter((pt) => allowedTypes.includes(pt.value)) : ALL_PAGE_TYPES);

	let title = $state('');
	// One-time default — allowedTypes doesn't change after this dialog mounts.
	// svelte-ignore state_referenced_locally
	let selectedType = $state<PageType>(PAGE_TYPES[0].value);
	let titleInput: HTMLInputElement;

	function submit() {
		const t = title.trim();
		if (!t) {
			titleInput.focus();
			return;
		}
		onResolve({ title: t, type: selectedType });
	}
	function cancel() {
		onResolve(null);
	}

	onMount(() => titleInput.focus());
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') cancel();
		if (e.key === 'Enter' && document.activeElement !== titleInput) submit();
	}}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- Escape is handled globally above; this is just backdrop-click-to-dismiss. -->
<div
	class="dialog-overlay"
	onclick={(e) => {
		if (e.target === e.currentTarget) cancel();
	}}
>
	<div class="dialog-box">
		<div class="dialog-title">{dialogTitle}</div>

		<label class="dialog-label" for="new-page-title">Title</label>
		<input
			id="new-page-title"
			bind:this={titleInput}
			type="text"
			class="dialog-input"
			placeholder="Page title…"
			bind:value={title}
			onkeydown={(e) => {
				if (e.key === 'Enter') submit();
			}}
		/>

		<div class="dialog-label">Type</div>
		<div class="dialog-type-list">
			{#each PAGE_TYPES as pt (pt.value)}
				<label class="dialog-type-row">
					<input type="radio" name="page-type" value={pt.value} bind:group={selectedType} />
					<span class="dialog-type-text">
						<strong>{pt.label}</strong><span class="dialog-type-desc"> — {pt.desc}</span>
					</span>
				</label>
			{/each}
		</div>

		<div class="dialog-actions">
			<button class="dialog-btn dialog-btn--cancel" onclick={cancel}>Cancel</button>
			<button class="dialog-btn dialog-btn--create" onclick={submit}>Create</button>
		</div>
	</div>
</div>
