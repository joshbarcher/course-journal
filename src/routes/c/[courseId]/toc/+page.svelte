<script lang="ts">
	import Toc from '$lib/components/Toc.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Toc courseId={data.course.id} pages={data.pages} />
