<script lang="ts">
	import type { PageProps } from './$types';
	import DocumentsList from '$lib/components/DocumentsList.svelte';

	let { data }: PageProps = $props();
</script>

<DocumentsList courseId={data.course.id} pages={data.pages} />
