import { randomUUID } from 'node:crypto';

const SIDEBAR_RENDER_TTL_MS = 60_000;

type StoredSidebarData = {
	data: Record<string, unknown>;
	expiresAt: number;
};

const sidebarRenderStore = new Map<string, StoredSidebarData>();

function pruneExpiredSidebarData() {
	const now = Date.now();
	for (const [id, value] of sidebarRenderStore) {
		if (value.expiresAt <= now) {
			sidebarRenderStore.delete(id);
		}
	}
}

export function putSidebarRenderData(data: Record<string, unknown>) {
	pruneExpiredSidebarData();
	const id = randomUUID();
	sidebarRenderStore.set(id, {
		data,
		expiresAt: Date.now() + SIDEBAR_RENDER_TTL_MS
	});
	return id;
}

export function getSidebarRenderData(id: string) {
	pruneExpiredSidebarData();
	const value = sidebarRenderStore.get(id);
	if (!value) return null;
	return value.data;
}

export function deleteSidebarRenderData(id: string) {
	sidebarRenderStore.delete(id);
}
