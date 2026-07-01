# JF UTM Builder

This directory is a self-contained application. It contains only the UTM builder, link library, Bitly shortening, QR generation, UTM intelligence, authentication, and their database migrations.

## Local setup

```bash
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3000/new`. The link library is available at `/utms` and the health endpoint is `/health`.

## Import an existing UTM library

Open `/imports` or select **Import CSV** from the sidebar. Choose a CSV exported from the Link Library and submit it. Matching links are skipped when the same file is imported again.

## Duplicate and reuse a link

Select **Duplicate** on a Link Library card. The builder opens with the existing destination and UTM values prefilled, but saving creates a new link and never changes the original. Change at least the destination or one UTM value before saving; exact destination-plus-five-UTM duplicates are rejected.

## Client-specific guidance

Add optional guidance to a client in `config/rules.js`:

```js
guidance: {
  summary: "Short explanation of this client's tracking ecosystem.",
  fields: {
    term: {
      label: "Campaign Term — Client-specific label",
      help: "Explain what belongs in this field.",
      placeholder: "example_value"
    }
  }
}
```

Guidance changes labels, helper copy, and examples only. It does not make optional UTM fields required. Castle is configured with Publication Name for Campaign Term and Issue Name for Campaign Content.

## Deployment

- Root directory: repository root
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/health`
- Node version: 22

The example configuration uses SQLite locally. For production, set the database configuration, `BITLY_ACCESS_TOKEN`, and a long random `TRACKING_SECRET_ENCRYPTION_KEY`. The application refuses to start without the signing secret. Generate one with `openssl rand -hex 32`.

To bootstrap the first administrator, temporarily set `SETUP_ADMIN_USERNAME` and `SETUP_ADMIN_PASSWORD`, restart the application, and use `/setup`. Clear both values and restart immediately after the administrator exists. Link deletion, CSV import, governance acknowledgement, and user management require an administrator account.

The builder compares populated UTM values and combinations against the selected client's workbook, imported, and saved-link history. Unfamiliar selections return `409 consistency_confirmation_required`; the UI requires an explicit **Create Anyway** confirmation using the returned `consistency_warning_fingerprint`. Confirmed standards remain available for administrator review in the Link Library.

Administrators can enable daily consistency-review email notifications and manage recipients from the Users page. Delivery runs once at 6:00 AM in the configured application timezone and only sends when review items exist. Configure `APP_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env`; credentials are never stored in the database or admin UI.

## Publish as its own repository

Copy this directory outside the parent project, then run:

```bash
git init
git add .
git commit -m "Initial standalone UTM Builder"
```



cd /home/ubuntu/UTM-BUILDER
git pull --ff-only
npm ci --omit=dev
npm run smoke
sudo systemctl restart utm-builder
sudo systemctl status utm-builder
