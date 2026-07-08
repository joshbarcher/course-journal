<script lang="ts">
	import type { PageProps } from './$types';
	import PlannersList from '$lib/components/PlannersList.svelte';

	let { data }: PageProps = $props();
</script>

<PlannersList courseId={data.courseId} plans={data.plans} />
