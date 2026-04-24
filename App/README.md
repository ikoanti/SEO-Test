# Mini SEO Tool App

This is now the primary SvelteKit target app.

## Routes

- `/login` — PocketBase-backed login screen
- `/audits` — list of audits and create a new audit
- `/audits/[auditId]` — view one stored audit

## Environment

Create `.env` from `.env.example` and configure:

```sh
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_AUTH_COLLECTION=app_users
POCKETBASE_AUDITS_COLLECTION=audits
```

## PocketBase expectations

The app assumes these PocketBase collections already exist:

- auth collection: `app_users`
- base collection: `audits`

Suggested fields:

### `audits`

- `name` — text
- `url` — url
- `created_by` — relation to `app_users`
- `status` — text
- `summary_json` — json/editor/text
- `audit_json` — json/editor/text

## Development

```sh
npm install
npm run dev
```

## Validation

```sh
npm run check
npm run build
```
