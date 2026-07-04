<script lang="ts">
	import CoursesGrid from '$lib/components/CoursesGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- No sidebar on this route — see routes/+layout.svelte for why this
     builds its own #app/#main-content wrapper instead of sharing one. -->
<div id="app">
	<main id="main-content">
		<CoursesGrid courses={data.courses} />
	</main>
</div>
