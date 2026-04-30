import type { AuditFindingStatus } from '$lib/audit-status';

export type AuditFindingView = {
	id: string;
	status?: AuditFindingStatus;
	title?: string;
	detail?: string;
	page_url?: string;
	meta?: Record<string, unknown> | null;
};

export type AuditItemView = {
	id: string;
	key: string;
	label: string;
	status?: AuditFindingStatus;
	runStatus?: string;
	summary?: string;
	stats?: unknown;
	itemRun?: {
		status?: string;
		started_at?: string;
		completed_at?: string;
		run_log?: string;
		error_message?: string;
	} | null;
	screenshot?: {
		id?: string;
		title?: string;
		page_url?: string;
		image_url?: string;
	} | null;
	findings: AuditFindingView[];
};

export type AuditPageViewData = {
	auditId: string;
	runRecord: {
		status?: string;
		error_message?: string;
		run_log?: string;
	};
	website?: {
		id?: string;
		url?: string;
		domain?: string;
		display_name?: string;
		name?: string;
	};
	auditRecord: {
		report_status?: string;
		google_drive_folder_id?: string;
		google_drive_folder_name?: string;
		google_doc_id?: string;
		google_doc_name?: string;
		google_doc_url?: string;
		google_doc_exported_at?: string;
	} | null;
	reportRecord: {
		status?: string;
		error_message?: string;
		started_at?: string;
		completed_at?: string;
	};
	audit: Record<string, unknown> | null;
	summary: {
		domain?: string;
		summary?: { passed?: number; warnings?: number; info?: number };
	} | null;
	reportPreviewItems: ReportPreviewItem[];
	reportTemplates: {
		key: string;
		title: string;
		priority: 'Urgent' | 'High' | 'Medium';
		match_pattern?: string;
		template_body: string;
		sort_order: number;
		findingTypeKey: string;
		findingTypeLabel: string;
	}[];
	selectedReportTemplateKeys: string[];
	aiVisibility: Record<string, unknown> | null;
	normalizedItems: AuditItemView[];
	findingDisplayItems?: AuditItemView[];
	isPendingReport?: boolean;
	isPendingScreenshots?: boolean;
};

export type ReportPreviewItem = {
	key: string;
	title: string;
	sourceFindingTypeKey: string;
	sourceLabel: string;
	sortOrder: number;
	status: AuditFindingStatus;
	priority: 'Urgent' | 'High' | 'Medium';
	paragraphs: string[];
	count: number;
	screenshot?: {
		id?: string;
		title?: string;
		page_url?: string;
		image_url?: string;
	} | null;
	findings: AuditFindingView[];
};

export type AuditNavItem = {
	key: string;
	title: string;
	href: string;
};
