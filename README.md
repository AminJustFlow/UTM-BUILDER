# JF UTM Builder

This directory is a self-contained application. It contains only the UTM builder, link library, Bitly shortening, QR generation, UTM intelligence, authentication, and their database migrations.

## Local setup

```bash
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3000/new`. The link library is available at `/utms` and the health endpoint is `/health`.

## Deployment

- Root directory: repository root
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/health`
- Node version: 22

Set the environment variables shown in `.env.example`. For production, use PostgreSQL and provide `DATABASE_URL`, `BITLY_ACCESS_TOKEN`, login credentials, and a long random `TRACKING_SECRET_ENCRYPTION_KEY`.

## Publish as its own repository

Copy this directory outside the parent project, then run:

```bash
git init
git add .
git commit -m "Initial standalone UTM Builder"
```
