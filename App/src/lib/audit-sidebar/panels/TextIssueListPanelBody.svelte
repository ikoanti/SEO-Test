<script lang="ts">
	import type { AuditEntry } from '../types';
	import IssueList, { type IssueListField } from '../IssueList.svelte';

	let {
		entries = [],
		fields = []
	}: {
		entries?: AuditEntry[];
		fields?: IssueListField[];
	} = $props();
</script>

<IssueList {entries} {fields} />
