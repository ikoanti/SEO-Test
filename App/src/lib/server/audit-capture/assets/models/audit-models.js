(function attachAuditModels(global) {
	/**
	 * @typedef {Object} AuditTab
	 * @property {string} id
	 * @property {string} label
	 */

	/**
	 * @typedef {Object} ImageAltEntry
	 * @property {string} page
	 * @property {string} image
	 */

	/**
	 * @typedef {Object} BrokenLinkEntry
	 * @property {string} page
	 * @property {string} link
	 */

	/**
	 * @typedef {Object} HeadingIssueEntry
	 * @property {string} page
	 * @property {string} issue
	 */

	/**
	 * @typedef {Object} ImageAltsPanelData
	 * @property {'image-alts'} kind
	 * @property {string} title
	 * @property {string} description
	 * @property {string} domain
	 * @property {number} count
	 * @property {ImageAltEntry[]} entries
	 */

	/**
	 * @typedef {Object} PlaceholderPanelData
	 * @property {'placeholder'} kind
	 * @property {string} title
	 * @property {string} description
	 */

	/**
	 * @typedef {Object} AIBotVisibilityPanelData
	 * @property {'ai-bot-visibility'} kind
	 * @property {string} title
	 * @property {string} description
	 * @property {string} domain
	 * @property {string[]} foundAgents
	 */

	/**
	 * @typedef {Object} BrokenLinksPanelData
	 * @property {'broken-links'} kind
	 * @property {string} title
	 * @property {string} description
	 * @property {string} domain
	 * @property {number} count
	 * @property {BrokenLinkEntry[]} entries
	 */

	/**
	 * @typedef {Object} HeadingsPanelData
	 * @property {'headings'} kind
	 * @property {string} title
	 * @property {string} description
	 * @property {string} domain
	 * @property {number} count
	 * @property {HeadingIssueEntry[]} entries
	 */

	/**
	 * @typedef {ImageAltsPanelData | PlaceholderPanelData | AIBotVisibilityPanelData | BrokenLinksPanelData | HeadingsPanelData} AuditPanelData
	 */

	/**
	 * @typedef {Object} AuditSidebarData
	 * @property {string} activeTab
	 * @property {AuditTab[]} tabs
	 * @property {Record<string, AuditPanelData>} panels
	 */

	const models = {
		/**
		 * @param {ImageAltEntry} entry
		 * @returns {ImageAltEntry}
		 */
		createImageAltEntry(entry) {
			return entry;
		},

		/**
		 * @param {BrokenLinkEntry} entry
		 * @returns {BrokenLinkEntry}
		 */
		createBrokenLinkEntry(entry) {
			return entry;
		},

		/**
		 * @param {HeadingIssueEntry} entry
		 * @returns {HeadingIssueEntry}
		 */
		createHeadingIssueEntry(entry) {
			return entry;
		},

		/**
		 * @param {ImageAltsPanelData} panel
		 * @returns {ImageAltsPanelData}
		 */
		createImageAltsPanel(panel) {
			return panel;
		},

		/**
		 * @param {PlaceholderPanelData} panel
		 * @returns {PlaceholderPanelData}
		 */
		createPlaceholderPanel(panel) {
			return panel;
		},

		/**
		 * @param {AIBotVisibilityPanelData} panel
		 * @returns {AIBotVisibilityPanelData}
		 */
		createAIBotVisibilityPanel(panel) {
			return panel;
		},

		/**
		 * @param {BrokenLinksPanelData} panel
		 * @returns {BrokenLinksPanelData}
		 */
		createBrokenLinksPanel(panel) {
			return panel;
		},

		/**
		 * @param {HeadingsPanelData} panel
		 * @returns {HeadingsPanelData}
		 */
		createHeadingsPanel(panel) {
			return panel;
		},

		/**
		 * @param {AuditSidebarData} sidebar
		 * @returns {AuditSidebarData}
		 */
		createAuditSidebarData(sidebar) {
			return sidebar;
		}
	};

	global.AutomagicAuditModels = models;
})(window);
