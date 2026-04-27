(function attachHtmlUtils(global) {
	global.AutomagicHtml = {
		escapeHtml(value) {
			return String(value)
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#39;');
		},
		formatValue(value) {
			const text = String(value ?? '');
			const escaped = this.escapeHtml(text);
			return escaped.replace(
				/https?:\/\/[^\s<>"']+/g,
				(url) => `<span class="url-value">${url}</span>`
			);
		}
	};
})(window);
