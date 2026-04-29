export type FormattedPart = {
	text: string;
	isUrl: boolean;
};

export function formattedParts(value: unknown): FormattedPart[] {
	const text = String(value ?? '');
	const parts: FormattedPart[] = [];
	const urlPattern = /https?:\/\/[^\s<>"']+/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = urlPattern.exec(text))) {
		if (match.index > lastIndex) {
			parts.push({ text: text.slice(lastIndex, match.index), isUrl: false });
		}
		parts.push({ text: match[0], isUrl: true });
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		parts.push({ text: text.slice(lastIndex), isUrl: false });
	}

	return parts.length ? parts : [{ text, isUrl: false }];
}

export function normalizeUrl(value: unknown) {
	try {
		const url = new URL(String(value ?? ''));
		url.hash = '';
		url.search = '';
		return url.href.replace(/\/+$/, '');
	} catch {
		return String(value ?? '').replace(/\/+$/, '');
	}
}

export function isActivePage(page: unknown, activePageUrl: unknown) {
	if (!page || !activePageUrl) return false;
	return normalizeUrl(page) === normalizeUrl(activePageUrl);
}
