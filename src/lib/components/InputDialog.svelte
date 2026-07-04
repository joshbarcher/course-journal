<script lang="ts">
	import { onMount } from 'svelte';

	let {
		title,
		placeholder = '',
		defaultValue = '',
		onResolve
	}: {
		title: string;
		placeholder?: string;
		defaultValue?: string;
		onResolve: (result: string | null) => void;
	} = $props();

	// Each dialog gets a freshly-mounted component instance (see
	// $lib/dialogs.ts), so capturing only the initial value is intentional.
	// svelte-ignore state_referenced_locally
	let value = $state(defaultValue);
	let inputEl: HTMLInputElement;

	function submit() {
		const v = value.trim();
		if (!v) {
			inputEl.focus();
			return;
		}
		onResolve(v);
	}
	function cancel() {
		onResolve(null);
	}

	onMount(() => {
		inputEl.focus();
		inputEl.select();
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') cancel();
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
		<div class="dialog-title">{title}</div>
		<input
			bind:this={inputEl}
			type="text"
			class="dialog-input"
			{placeholder}
			bind:value
			onkeydown={(e) => {
				if (e.key === 'Enter') submit();
			}}
		/>
		<div class="dialog-actions">
			<button class="dialog-btn dialog-btn--cancel" onclick={cancel}>Cancel</button>
			<button class="dialog-btn dialog-btn--create" onclick={submit}>OK</button>
		</div>
	</div>
</div>
