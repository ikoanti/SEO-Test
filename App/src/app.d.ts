declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				email?: string;
				name?: string;
				[key: string]: unknown;
			} | null;
			pbToken?: string | undefined;
		}
	}
}

export {};
