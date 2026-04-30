import { Readable } from 'node:stream';
import { env } from '$env/dynamic/private';
import { google } from 'googleapis';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type UploadedGoogleDoc = {
	id: string;
	name: string;
	url: string;
	folderId: string;
	folderName: string;
};

function requiredEnv(name: string) {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} is required for Google Drive export.`);
	return value;
}

function privateKey() {
	return requiredEnv('GOOGLE_WORKSPACE_PRIVATE_KEY').replace(/\\n/g, '\n');
}

function authClient(scopes: string[]) {
	return new google.auth.JWT({
		email: requiredEnv('GOOGLE_WORKSPACE_CLIENT_EMAIL'),
		key: privateKey(),
		subject: requiredEnv('GOOGLE_WORKSPACE_IMPERSONATE_EMAIL'),
		scopes
	});
}

function driveClient() {
	return google.drive({
		version: 'v3',
		auth: authClient(['https://www.googleapis.com/auth/drive'])
	});
}

function docsClient() {
	return google.docs({
		version: 'v1',
		auth: authClient(['https://www.googleapis.com/auth/documents'])
	});
}

async function assertPagelessAccess() {
	await authClient(['https://www.googleapis.com/auth/documents']).authorize();
}

function escapeDriveQueryValue(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function websiteFolderName(domain: string) {
	return (
		domain
			.trim()
			.replace(/^https?:\/\//i, '')
			.replace(/^www\./i, '')
			.replace(/\/.*$/, '')
			.replace(/[^a-z0-9._-]+/gi, '-')
			.replace(/^-+|-+$/g, '') || 'unknown-domain'
	);
}

function googleDocName(filename: string) {
	const baseName = filename
		.replace(/\.docx$/i, '')
		.replace(/-/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
	return `${baseName || 'Mini SEO Audit'} - ${timestamp}`;
}

function bodyBuffer(body: Buffer | Uint8Array | ArrayBuffer) {
	if (Buffer.isBuffer(body)) return body;
	if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body));
	return Buffer.from(body);
}

async function getOrCreateFolder(parentFolderId: string, name: string) {
	const drive = driveClient();
	const escapedName = escapeDriveQueryValue(name);
	const escapedParent = escapeDriveQueryValue(parentFolderId);
	const existing = await drive.files.list({
		q: [
			`mimeType = '${FOLDER_MIME_TYPE}'`,
			`name = '${escapedName}'`,
			`'${escapedParent}' in parents`,
			'trashed = false'
		].join(' and '),
		fields: 'files(id,name)',
		pageSize: 1,
		supportsAllDrives: true,
		includeItemsFromAllDrives: true
	});
	const folder = existing.data.files?.[0];
	if (folder?.id) return { id: folder.id, name: folder.name || name };

	const created = await drive.files.create({
		requestBody: {
			name,
			mimeType: FOLDER_MIME_TYPE,
			parents: [parentFolderId]
		},
		fields: 'id,name',
		supportsAllDrives: true
	});

	if (!created.data.id) throw new Error('Google Drive did not return a folder id.');
	return { id: created.data.id, name: created.data.name || name };
}

async function setPageless(documentId: string) {
	const docs = docsClient();
	await docs.documents.batchUpdate({
		documentId,
		requestBody: {
			requests: [
				{
					updateDocumentStyle: {
						documentStyle: {
							documentFormat: {
								documentMode: 'PAGELESS'
							}
						},
						fields: 'documentFormat.documentMode'
					}
				}
			]
		}
	});
}

export async function uploadAuditDocxAsGoogleDoc(input: {
	domain: string;
	filename: string;
	body: Buffer | Uint8Array | ArrayBuffer;
}): Promise<UploadedGoogleDoc> {
	const rootFolderId = requiredEnv('GOOGLE_DRIVE_AUDIT_ROOT_FOLDER_ID');
	await assertPagelessAccess();
	const folder = await getOrCreateFolder(rootFolderId, websiteFolderName(input.domain));
	const drive = driveClient();
	const body = bodyBuffer(input.body);
	const uploaded = await drive.files.create({
		requestBody: {
			name: googleDocName(input.filename),
			mimeType: GOOGLE_DOC_MIME_TYPE,
			parents: [folder.id]
		},
		media: {
			mimeType: DOCX_MIME_TYPE,
			body: Readable.from(body)
		},
		fields: 'id,name,webViewLink',
		supportsAllDrives: true
	});

	if (!uploaded.data.id) throw new Error('Google Drive did not return a document id.');
	await setPageless(uploaded.data.id);

	return {
		id: uploaded.data.id,
		name: uploaded.data.name || input.filename,
		url: uploaded.data.webViewLink || `https://docs.google.com/document/d/${uploaded.data.id}/edit`,
		folderId: folder.id,
		folderName: folder.name
	};
}
