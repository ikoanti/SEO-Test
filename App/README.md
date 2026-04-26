# Mini SEO Tool App

This is now the primary SvelteKit target app.

## Routes

- `/login` — PocketBase-backed login screen
- `/audits` — list of runs and create a new audit run
- `/audits/[auditId]` — view a running audit state or completed audit result

## Environment

Environment is centralized in `../Infrastructure/.env`.

`App/.env.local` is a symlink to `../Infrastructure/.env` so SvelteKit can read the same values during local development.

## PocketBase expectations

The app assumes these PocketBase collections already exist:

- auth collection: `users`
- base collection: `runs`
- base collection: `audits`

Suggested fields:

### `runs`

- `name` — text
- `url` — url
- `created_by` — relation to `users`
- `status` — text
- `queued_at` — date
- `started_at` — date
- `completed_at` — date
- `error_message` — text/editor
- `run_log` — editor/text

### `audits`

- `run` — relation to `runs`
- `name` — text
- `url` — url
- `created_by` — relation to `users`
- `completed_at` — date
- `summary_json` — json/editor/text
- `report_html` — editor/text
- `ai_visibility_json` — editor/text
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
