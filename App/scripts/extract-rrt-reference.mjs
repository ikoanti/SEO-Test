import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const defaultInput = path.join(repoRoot, 'RRT.html');
const inputPath = path.resolve(process.argv[2] || defaultInput);

const html = fs.readFileSync(inputPath, 'utf8');
const $ = cheerio.load(html);
const styleText = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
	.map((match) => match[1])
	.sort((first, second) => second.length - first.length)[0];

const landmarks = [
	'Rich Results Test',
	'Test results',
	'valid items detected',
	'Valid items are eligible',
	'View tested page',
	'Preview results',
	'Details',
	'Crawl',
	'Crawled successfully',
	'Detected structured data',
	'Additional resources',
	'Tested page'
];

function ownText(element) {
	return $(element).clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
}

function nodePath(element) {
	const parts = [];
	let node = element;
	while (node?.type === 'tag' && parts.length < 10) {
		const classes = ($(node).attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 5);
		parts.push(`${node.name}${classes.length ? `.${classes.join('.')}` : ''}`);
		node = node.parent;
	}
	return parts.join(' <- ');
}

function cssRulesForClass(className) {
	const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const rulePattern = new RegExp(`([^{}]*\\.${escaped}(?:[\\s.#:[,{][^{}]*)?)\\{([^{}]*)\\}`, 'g');
	const rules = [];
	let match;
	while ((match = rulePattern.exec(styleText)) && rules.length < 8) {
		rules.push(`${match[1].trim()}{${match[2].trim()}}`);
	}
	return rules;
}

const matches = landmarks.map((landmark) => {
	const elements = [];
	$('*').each((_, element) => {
		const text = ownText(element);
		if (text.toLowerCase().includes(landmark.toLowerCase())) {
			elements.push({
				text,
				path: nodePath(element),
				classes: ($(element).attr('class') || '').split(/\s+/).filter(Boolean)
			});
		}
	});
	return { landmark, elements: elements.slice(0, 5) };
});

const classNames = Array.from(new Set(matches.flatMap((match) => match.elements.flatMap((el) => el.classes))));
const css = Object.fromEntries(
	classNames
		.map((className) => [className, cssRulesForClass(className)])
		.filter(([, rules]) => rules.length)
);

console.log(JSON.stringify({ inputPath, landmarks: matches, css }, null, 2));
