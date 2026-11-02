# USAMarket live-site Worker

This Worker is intended to replace the current static-assets-only deployment
for the existing `usamarket-live` service. It serves the repository's existing
website files through the `ASSETS` binding while handling `/api/*` in Worker
code first.

## Cloudflare Workers Builds

Configure a separate preview build for this directory after reviewing this PR:

- Root directory: `cloudflare/usamarket-live-worker`
- Build command: `node build-assets.mjs`
- Deploy command: `npx wrangler deploy`

The build script stages the current site into `dist`, excluding repository
metadata and Cloudflare source/configuration files. Do not deploy to production
until the preview has been checked for the homepage, CSS/JS, images, news JSON,
sitemap, PWA files, and shop routes.

## Routes

- `GET /health` — runtime health check
- `GET /api/health` — same health check
- `GET /api/admitad/products` — intentionally returns HTTP 503 until the
  real Admitad OAuth/feed implementation and Runtime secrets are configured.
- All other paths — served from the staged static site assets.

## Security and rollout

- This configuration targets `usamarket-live`, not `usamarket-admitad`.
- Never commit client secrets, access/refresh tokens, or private feed URLs.
- Add secrets only in the `usamarket-live` Worker Runtime variables and secrets.
- Keep the current production deployment until all preview smoke tests pass.
