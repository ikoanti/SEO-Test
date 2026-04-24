const PocketBaseModule = require('pocketbase');

const PocketBase = PocketBaseModule.default || PocketBaseModule;

const DEFAULT_AUDITS_COLLECTION = 'audit_runs';
const DEFAULT_REPORTS_COLLECTION = 'audit_reports';
const DEFAULT_AUTH_COLLECTION = 'app_users';

let pocketBaseClientPromise = null;

function getConfig() {
    return {
        url: process.env.POCKETBASE_URL || '',
        superuserEmail: process.env.POCKETBASE_SUPERUSER_EMAIL || '',
        superuserPassword: process.env.POCKETBASE_SUPERUSER_PASSWORD || '',
        authCollection: process.env.POCKETBASE_AUTH_COLLECTION || DEFAULT_AUTH_COLLECTION,
        auditsCollection: process.env.POCKETBASE_AUDITS_COLLECTION || DEFAULT_AUDITS_COLLECTION,
        reportsCollection: process.env.POCKETBASE_REPORTS_COLLECTION || DEFAULT_REPORTS_COLLECTION
    };
}

function getStatus() {
    const config = getConfig();
    const missing = [];

    if (!config.url) missing.push('POCKETBASE_URL');
    if (!config.superuserEmail) missing.push('POCKETBASE_SUPERUSER_EMAIL');
    if (!config.superuserPassword) missing.push('POCKETBASE_SUPERUSER_PASSWORD');

    return {
        configured: missing.length === 0,
        missing,
        url: config.url,
        authCollection: config.authCollection,
        auditsCollection: config.auditsCollection,
        reportsCollection: config.reportsCollection
    };
}

function parseDomain(targetUrl, fallback = '') {
    try {
        return new URL(targetUrl).hostname;
    } catch {
        return fallback;
    }
}

async function getClient() {
    const status = getStatus();
    if (!status.configured) {
        throw new Error(`PocketBase is not configured. Missing: ${status.missing.join(', ')}`);
    }

    if (!pocketBaseClientPromise) {
        pocketBaseClientPromise = (async () => {
            const config = getConfig();
            const client = new PocketBase(config.url);

            if (typeof client.autoCancellation === 'function') {
                client.autoCancellation(false);
            }

            await client.collection('_superusers').authWithPassword(
                config.superuserEmail,
                config.superuserPassword
            );

            return client;
        })().catch((error) => {
            pocketBaseClientPromise = null;
            throw error;
        });
    }

    return pocketBaseClientPromise;
}

async function createRecord(collectionName, payload) {
    const client = await getClient();
    return client.collection(collectionName).create(payload);
}

function createClient(baseUrl) {
    const client = new PocketBase(baseUrl);

    if (typeof client.autoCancellation === 'function') {
        client.autoCancellation(false);
    }

    return client;
}

async function loginAppUser(email, password) {
    const status = getStatus();
    if (!status.configured) {
        throw new Error(`PocketBase is not configured. Missing: ${status.missing.join(', ')}`);
    }

    const client = createClient(status.url);
    const authData = await client.collection(status.authCollection).authWithPassword(email, password);

    return {
        token: authData?.token || client.authStore.token,
        record: authData?.record || client.authStore.record,
        collection: status.authCollection
    };
}

async function authenticateAppToken(token) {
    const status = getStatus();
    if (!status.configured) {
        throw new Error(`PocketBase is not configured. Missing: ${status.missing.join(', ')}`);
    }
    if (!token) {
        throw new Error('Missing auth token');
    }

    const client = createClient(status.url);
    client.authStore.save(token);

    const authData = await client.collection(status.authCollection).authRefresh();

    return {
        token: authData?.token || client.authStore.token,
        record: authData?.record || client.authStore.record,
        collection: status.authCollection
    };
}

async function saveAuditRun({ targetUrl, auditData }) {
    const status = getStatus();
    if (!status.configured) {
        return { saved: false, skipped: true, reason: `Missing ${status.missing.join(', ')}` };
    }

    const payload = {
        target_url: auditData?.crawl?.homepage || targetUrl,
        domain: auditData?.domain || parseDomain(targetUrl),
        audited_at: auditData?.auditedAt || new Date().toISOString(),
        passed_count: Number(auditData?.summary?.passed || 0),
        warning_count: Number(auditData?.summary?.warnings || 0),
        failed_count: Number(auditData?.summary?.failed || 0),
        audit_json: JSON.stringify(auditData || {})
    };

    try {
        const record = await createRecord(status.auditsCollection, payload);
        return { saved: true, collection: status.auditsCollection, id: record.id };
    } catch (error) {
        return { saved: false, skipped: false, error: error.message };
    }
}

async function saveGeneratedReport({ targetUrl, domain, auditData, reportHtml }) {
    const status = getStatus();
    if (!status.configured) {
        return { saved: false, skipped: true, reason: `Missing ${status.missing.join(', ')}` };
    }

    const payload = {
        target_url: targetUrl,
        domain: domain || auditData?.domain || parseDomain(targetUrl, domain),
        generated_at: new Date().toISOString(),
        passed_count: Number(auditData?.summary?.passed || 0),
        warning_count: Number(auditData?.summary?.warnings || 0),
        failed_count: Number(auditData?.summary?.failed || 0),
        audit_json: JSON.stringify(auditData || {}),
        report_html: reportHtml || ''
    };

    try {
        const record = await createRecord(status.reportsCollection, payload);
        return { saved: true, collection: status.reportsCollection, id: record.id };
    } catch (error) {
        return { saved: false, skipped: false, error: error.message };
    }
}

module.exports = {
    authenticateAppToken,
    getPocketBaseStatus: getStatus,
    loginAppUser,
    saveAuditRun,
    saveGeneratedReport
};
