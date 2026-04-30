export type AuditTab = {
	id: string;
	label: string;
};

export type AuditEntry = {
	page?: string;
	issue?: string;
	image?: string;
	link?: string;
	value?: string;
	count?: number;
	property?: string;
	pattern?: string;
	wordCount?: number;
	status?: 'pass' | 'warn' | 'info';
};

export type BasePanelData = {
	kind: string;
	title?: string;
	description?: string;
	domain?: string;
	count?: number;
	entries?: AuditEntry[];
};

export type AIBotVisibilityPanelData = BasePanelData & {
	kind: 'ai-bot-visibility';
	foundAgents?: string[];
};

export type MetaTagsPanelData = BasePanelData & {
	kind: 'meta-tags';
	activePageUrl?: string;
};

export type PageSpeedPanelData = BasePanelData & {
	kind: 'pagespeed';
	pageSpeed?: Record<string, PageSpeedStrategyData | undefined>;
};

export type PageSpeedStrategyData = {
	score?: string | number;
	metrics?: Record<string, string | number | undefined>;
};

export type PlaceholderPanelData = BasePanelData & {
	kind: 'placeholder';
};

export type AuditPanelData =
	| AIBotVisibilityPanelData
	| MetaTagsPanelData
	| PageSpeedPanelData
	| PlaceholderPanelData
	| BasePanelData;

export type AuditSidebarData = {
	activeTab?: string;
	tabs?: AuditTab[];
	panels?: Record<string, AuditPanelData | undefined>;
};
