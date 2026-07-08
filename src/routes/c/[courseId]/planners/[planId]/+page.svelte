<script lang="ts">
	import type { PageProps } from './$types';
	import LecturePlanPage from '$lib/components/pages/LecturePlanPage.svelte';

	let { data }: PageProps = $props();
</script>

{#if !data.plan}
	<p class="page-error">Weekly Lecture Plan not found.</p>
{:else}
	{#key data.plan.id}
		<LecturePlanPage courseId={data.courseId} plan={data.plan} />
	{/key}
{/if}
