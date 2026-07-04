<script lang="ts">
	let {
		title,
		body,
		confirmLabel = 'Confirm',
		onResolve
	}: {
		title: string;
		body: string;
		confirmLabel?: string;
		onResolve: (result: boolean) => void;
	} = $props();

	let confirmBtn: HTMLButtonElement;

	function confirm() {
		onResolve(true);
	}
	function cancel() {
		onResolve(false);
	}

	import { onMount } from 'svelte';
	onMount(() => confirmBtn.focus());
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') cancel();
		if (e.key === 'Enter') confirm();
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
		<div class="dialog-body">{body}</div>
		<div class="dialog-actions">
			<button class="dialog-btn dialog-btn--cancel" onclick={cancel}>Cancel</button>
			<button bind:this={confirmBtn} class="dialog-btn dialog-btn--confirm" onclick={confirm}>{confirmLabel}</button>
		</div>
	</div>
</div>
