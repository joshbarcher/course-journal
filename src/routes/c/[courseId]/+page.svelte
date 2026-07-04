<script lang="ts">
	import Heatmap from '$lib/components/Heatmap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Heatmap courseId={data.course.id} pages={data.pages} />
