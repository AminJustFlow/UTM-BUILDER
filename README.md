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

The example configuration uses SQLite locally. For production, set `DATABASE_CLIENT=postgres` and provide `DATABASE_URL`, `BITLY_ACCESS_TOKEN`, login credentials, and a long random `TRACKING_SECRET_ENCRYPTION_KEY`.

## Publish as its own repository

Copy this directory outside the parent project, then run:

```bash
git init
git add .
git commit -m "Initial standalone UTM Builder"
```
