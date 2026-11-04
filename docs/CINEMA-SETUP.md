# USAMARKET CINEMA — publishing and media setup

## Current implementation

- Public catalogue: `/cinema/`
- In-site player: `/cinema/watch.html?id=<title-id>`
- Worker API: `GET /api/cinema/catalog` and `GET /api/cinema/catalog?id=<title-id>`
- Catalogue storage: existing `VIDEOS_KV` namespace, key `cinema:v1:catalog`
- The API only returns entries marked `active: true` and `rightsStatus: "verified"`, with a licence label, a rights-evidence URL, and an HTTPS playback URL whose hostname is allowlisted.
- The player is an HTML5 video player for direct MP4 media URLs. No film files are currently included or published by this change.

## Cloudflare setup required before any title can play

1. Create a dedicated Cloudflare R2 bucket for cinema media (for example, `usamarket-cinema-media`).
2. Connect a dedicated custom domain to that bucket (for example, `media.usamarket.live`). Do not use an unprotected bucket listing.
3. Upload only media that USAMARKET is authorised to host. Use MP4/H.264 + AAC for broad browser compatibility and ensure byte-range requests work for seeking.
4. In the `usamarket-live` Worker, set the non-secret variable `CINEMA_MEDIA_HOSTS` to the exact media hostname, e.g. `media.usamarket.live`. Do not include a scheme or path.
5. Add the catalogue JSON below to the existing KV namespace `VIDEOS_KV` under the exact key `cinema:v1:catalog`.

No new R2 bucket or domain is created automatically by the code deployment. The Cloudflare account owner must create and bind the storage/domain in the dashboard.

## Catalogue record format

Store one JSON object with an `items` array. Only publish verified entries:

```json
{
  "items": [
    {
      "id": "example-public-domain-film",
      "title": "Example Public-Domain Film",
      "year": 1920,
      "category": "film",
      "description": "Replace with a factual description of the title.",
      "poster": "https://media.usamarket.live/posters/example.jpg",
      "duration": "70 min",
      "playbackUrl": "https://media.usamarket.live/films/example.mp4",
      "active": true,
      "rightsStatus": "verified",
      "license": "Public domain — verified for the intended territories",
      "rightsEvidence": "https://example.org/rights-record-for-this-title"
    }
  ]
}
```

The example is a schema illustration only and is not a real title or a rights determination. Replace every field with verified information. Keep `items` empty until a title's rights have been checked.

## Rights review checklist per title

- Confirm the specific film/version, soundtrack, subtitles and poster are covered.
- Confirm the public-domain status or licence in the territories where the service is offered.
- Confirm the licence permits hosting/streaming from USAMARKET, not merely personal viewing or linking.
- Confirm the source permits the intended commercial context and advertising, if ads are enabled.
- Save a stable rights-evidence URL and a copy of the evidence in the project's internal records.
- If any point is unclear, do not publish the title.

## Operational notes

- Do not upload copyrighted films based only on their presence on an archive website.
- Keep the R2 bucket dedicated to cleared cinema media; do not mix it with user uploads or affiliate assets.
- The current API is read-only by design. Update the KV catalogue only through an authorised Cloudflare dashboard workflow.
- The current catalogue will correctly show an empty state until an allowlisted media hostname and verified catalogue records are configured.
