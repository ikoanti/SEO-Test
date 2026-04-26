import adapter from '@sveltejs/adapter-node';
import type { Config } from '@sveltejs/kit';

const config: Config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		paths: {
			relative: false
		}
	}
};

export default config;
