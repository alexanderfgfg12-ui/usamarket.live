# Affiliate catalogue integration

The storefront is static and compatible with the repository's GitHub Pages-style hosting. It never exposes partner API credentials in browser JavaScript.

## Feed contract

Configure the GitHub Actions repository secret `AFFILIATE_FEED_URLS` as a comma-separated list of HTTPS endpoints. Each endpoint must return JSON:

```json
{
  "products": [{
    "id": "partner-product-id",
    "title": "Product name",
    "description": "Short factual description",
    "brand": "Brand",
    "category": "Electronics",
    "image": "https://cdn.example.com/product.jpg",
    "price": 99.95,
    "oldPrice": 119.95,
    "currency": "USD",
    "affiliateUrl": "https://partner.example.com/tracking-link",
    "source": "Awin"
  }]
}
```

A partner-specific feed adapter must convert each approved network export/API response into this contract. Awin and CJ feed exports may be CSV/XML depending on the account and product; do not paste private feed URLs into public files. Amazon product data must be obtained through an approved Amazon Associates method (such as Product Advertising API where the account is eligible) and must follow Amazon's content, image, price-refresh, attribution and disclosure rules. Do not scrape retailer pages or invent product prices.

## Enable scheduled sync

1. Obtain feed/API access and tracking IDs from each affiliate network.
2. Deploy a small private feed adapter (or generate normalized JSON feeds in a secure scheduled job) for each network.
3. In GitHub repository Settings → Secrets and variables → Actions, add secret `AFFILIATE_FEED_URLS` containing comma-separated HTTPS URLs for the normalized feeds.
4. Run **Actions → Sync affiliate products → Run workflow** once and inspect the log.
5. The workflow then refreshes the public catalogue every six hours.

The workflow intentionally keeps the current catalogue unchanged when no feeds are configured. A failed configured feed fails the run rather than publishing an incomplete catalogue. Affiliate links are marked `rel="sponsored nofollow"`; the storefront includes an affiliate disclosure.

## Product fields

Required: `title`, valid `affiliateUrl`. Recommended: `image`, `price`, `currency`, `description`, `category`, `source`. Only publish products and assets permitted by the partner's terms. Confirm local disclosure and consumer-protection requirements for the markets you target.


## Named Admitad feed sources

Each entry in feeds.json has a display name and a secretEnv key. The importer resolves the URL from that GitHub Actions secret first, then uses the existing inline URL only as a temporary fallback.

- `ADMITAD_TEMPLATE_79310_URL` — Admitad template 79310
- `ADMITAD_TEMPLATE_79311_URL` — Admitad template 79311
- `ADMITAD_TEMPLATE_79312_URL` — Admitad template 79312
- `ADMITAD_TEMPLATE_79319_URL` — Admitad template 79319
- `ADMITAD_TEMPLATE_79320_URL` — Admitad template 79320
- `ADMITAD_TEMPLATE_79321_URL` — Admitad template 79321
- `ADMITAD_TEMPLATE_79322_URL` — Admitad template 79322
- `ADMITAD_TEMPLATE_79323_URL` — Admitad template 79323
- `ADMITAD_TEMPLATE_79324_URL` — Admitad template 79324
- `ADMITAD_TEMPLATE_79335_URL` — Admitad template 79335
- `ADMITAD_TEMPLATE_79336_URL` — Admitad template 79336
- `ADMITAD_TEMPLATE_79337_URL` — Admitad template 79337

Add each private export URL as the value of its matching repository secret under Settings → Secrets and variables → Actions. Never commit secret values. The importer logs source names, product counts and per-source errors without printing URLs or secret values; results are also written to shop/products-manifest.json.
