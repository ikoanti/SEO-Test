import { error } from '@sveltejs/kit';
import type { ReportPriority, ReportPriorityOverrides } from '$lib/server/report-docx';

const REPORT_PRIORITIES = new Set<ReportPriority>(['Urgent', 'High', 'Medium']);

export function selectedTemplateKeys(values: Iterable<string>, availableKeys: Set<string>) {
	return [
		...new Set([...values].map((value) => String(value)).filter((key) => availableKeys.has(key)))
	];
}

export function validateReportSelection(selectedKeys: string[], availableKeys: Set<string>) {
	const minSelection = Math.min(5, availableKeys.size);

	if (availableKeys.size > 0 && selectedKeys.length < minSelection) {
		throw error(
			400,
			`Select at least ${minSelection} finding${minSelection === 1 ? '' : 's'} for the export.`
		);
	}

	if (selectedKeys.length > 10) {
		throw error(400, 'Select no more than 10 findings for the export.');
	}
}

export function priorityOverridesFromEntries(
	entries: Iterable<[string, FormDataEntryValue | string]>,
	selectedKeys: Set<string>
) {
	const overrides: ReportPriorityOverrides = {};

	for (const [key, value] of entries) {
		if (!key.startsWith('reportPriority:')) continue;

		const templateKey = key.slice('reportPriority:'.length);
		const priority = String(value);
		if (!selectedKeys.has(templateKey) || !REPORT_PRIORITIES.has(priority as ReportPriority)) {
			continue;
		}

		overrides[templateKey] = priority as ReportPriority;
	}

	return overrides;
}
