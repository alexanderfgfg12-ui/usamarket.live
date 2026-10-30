# USAMarket Admitad Worker

This directory contains the Cloudflare Worker backend for the USAMarket affiliate integration.

## Deployment

Connect this repository to Cloudflare Workers Builds and set the root directory to
`cloudflare/admitad-worker`. The build command can be left empty; the deploy command
is `npx wrangler deploy`.

The first version exposes only `/` and `/health` as a safe health check. It does not
accept credentials or exchange OAuth tokens yet.

## Security

- Never commit Admitad Client Secret, access tokens, refresh tokens, or private feed URLs.
- Add credentials only through Cloudflare Worker Settings → Variables and Secrets.
- OAuth callback URL must use the deployed Worker HTTPS hostname.
- OAuth state storage and token persistence must be configured before enabling OAuth routes.

## Required future configuration

- `ADMITAD_CLIENT_ID` — secret/config variable in Cloudflare
- `ADMITAD_CLIENT_SECRET` — secret in Cloudflare (never a repository file)
- `ADMITAD_REDIRECT_URI` — exact HTTPS callback URL registered with Admitad
