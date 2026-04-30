import type { AuditPanelData, AuditSidebarData } from './types';

export function buildSidebarData(
	activeTab: string,
	panel: AuditPanelData | Record<string, unknown>,
	tabs?: AuditSidebarData['tabs']
): AuditSidebarData {
	const tabLabel = typeof panel.title === 'string' && panel.title.trim() ? panel.title : activeTab;

	return {
		activeTab,
		tabs: tabs?.length ? tabs : [{ id: activeTab, label: tabLabel }],
		panels: {
			[activeTab]: panel as AuditPanelData
		}
	};
}
