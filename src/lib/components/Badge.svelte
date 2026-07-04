<script lang="ts">
	// Ported from heatmap.js's _buildBadge().
	let {
		icon,
		title,
		themeClass,
		large = false,
		isSuper = false
	}: { icon: string; title: string; themeClass: string; large?: boolean; isSuper?: boolean } = $props();

	const delay = `${Math.random() * 0.15}s`;
</script>

<div class="badge-wrap" style:animation-delay={delay}>
	<div class="badge {themeClass}" class:badge--large={large}>
		<div class="badge-icon">
			{#if isSuper}
				<span>{icon}</span>
				<span>{icon}</span>
			{:else}
				{icon}
			{/if}
		</div>
	</div>
	<div class="badge-label">{title}</div>
</div>
