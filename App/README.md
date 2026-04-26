# Mini SEO Tool App

This is now the primary SvelteKit target app.

## Routes

- `/login` — PocketBase-backed login screen
- `/audits` — list audits and create a new audit workflow
- `/audits/[auditId]` — view a running audit state or completed audit result

## Environment

Environment is centralized in `../Infrastructure/.env`.

Use `../Infrastructure/.env` as the single environment source for the Docker stack.

## PocketBase expectations

The app assumes these PocketBase collections already exist:

- auth collection: `users`
- base collection: `websites`
- base collection: `audits`
- base collection: `workflows`
- base collection: `runs`
- base collection: `audit_finding_types`
- base collection: `audit_findings`

Data model:

### `websites`

- `url` — url
- `domain` — text

### `audits`

- `website` — relation to `websites`
- `created_by` — relation to `users`
- `status` — text
- `completed_at` — date
- `summary_json` — json/editor/text
- `report_html` — editor/text
- `ai_visibility_json` — editor/text
- `audit_json` — json/editor/text

### `workflows`

- `audit` — relation to `audits`
- `status` — text
- `queued_at` — date
- `started_at` — date
- `completed_at` — date
- `error_message` — editor/text
- `run_log` — editor/text

### `runs`

- `workflow` — relation to `workflows`
- `audit_finding_type` — relation to `audit_finding_types`
- `status` — text
- `started_at` — date
- `completed_at` — date
- `error_message` — editor/text
- `run_log` — editor/text

### `audit_finding_types`

- `key` — text
- `label` — text
- `sort_order` — number

### `audit_findings`

- `audit` — relation to `audits`
- `audit_finding_type` — relation to `audit_finding_types`
- `run` — relation to `runs`
- `status` — text
- `title` — text
- `detail` — editor/text
- `page_url` — url
- `meta_json` — editor/text

## Development

Run the app through the root Docker workflow instead of starting Vite directly:

```sh
cd ..
just dev
```

## Validation

```sh
npm run check
npm run build
```
