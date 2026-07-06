<script lang="ts">
	import type { PageProps } from './$types';
	import LecturePlanPage from '$lib/components/pages/LecturePlanPage.svelte';

	let { data }: PageProps = $props();
</script>

<!--
  Keyed by courseId: unlike the [pageId] route, this route has no
  naturally-changing param to force a remount when navigating directly
  between two different courses' lecture plans, so this key does that job
  instead (fresh $state instead of stale state from the previous course).
-->
{#key data.courseId}
	<LecturePlanPage courseId={data.courseId} plan={data.lecturePlan} />
{/key}
