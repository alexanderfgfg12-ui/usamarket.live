# USAMarket live-site Worker

This Worker is intended to replace the current static-assets-only deployment
for the existing `usamarket-live` service. It keeps the website files in the
repository root and serves them through the `ASSETS` binding, while allowing
`/api/*` requests to be handled by Worker code first.

## Cloudflare Workers Builds

Configure the build for this directory only after reviewing this pull request:

- Root directory: `cloudflare/usamarket-live-worker`
- Build command: leave empty
- Deploy command: `npx wrangler deploy`

The Wrangler assets directory points back to the repository root. Do not
deploy this configuration to production until the preview deployment has been
checked for the homepage, CSS/JS, images, news JSON, sitemap, PWA files, and
shop routes.

## Routes

- `GET /health` — runtime health check
- `GET /api/health` — same health check
- `GET /api/admitad/products` — intentionally returns HTTP 503 until the
  real Admitad OAuth/feed implementation and Runtime secrets are configured.
- All other paths — served from the repository's static site assets.

## Security and rollout

- This configuration targets `usamarket-live`, not `usamarket-admitad`.
- Never commit client secrets, access/refresh tokens, or private feed URLs.
- Add secrets only in the `usamarket-live` Worker Runtime variables and secrets.
- Keep the current production deployment until all preview smoke tests pass.
