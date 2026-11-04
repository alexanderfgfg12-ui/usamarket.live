# USAMARKET CINEMA — publishing and media setup

## Current implementation

- Public catalogue: `/cinema/`
- In-site player: `/cinema/watch.html?id=<title-id>`
- Worker API: `GET /api/cinema/catalog` and `GET /api/cinema/catalog?id=<title-id>`
- Catalogue storage: version-controlled `cinema/catalog.json` in GitHub (no card or paid storage required); the Worker prefers a populated `VIDEOS_KV` catalogue if one exists, then falls back to the GitHub-hosted JSON file
- The API only returns entries marked `active: true` and `rightsStatus: "verified"`, with a licence label, a rights-evidence URL, and an HTTPS playback URL. The default media-host allowlist accepts `archive.org` and `upload.wikimedia.org` (including their subdomains); additional reviewed hosts can be added with the optional `CINEMA_MEDIA_HOSTS` Worker variable.
- The player is an HTML5 video player for direct MP4 media URLs. No film files are currently included or published by this change.

## Free GitHub catalogue workflow (no bank card)

1. Edit `cinema/catalog.json` in the GitHub repository.
2. Add only titles whose specific version, soundtrack, subtitles and poster have been checked for public-domain status or a licence that permits the intended streaming and advertising.
3. Set `active` to `true` and `rightsStatus` to `verified` only after that review; otherwise keep the record out of the catalogue.
4. Use a direct HTTPS MP4 URL from an approved host (`archive.org` or `upload.wikimedia.org` by default). The in-site player requires a browser-playable media file and byte-range support for seeking.
5. Commit the JSON change. The Worker reads the file from the site's static assets when the KV catalogue is absent or empty.

No R2 bucket, payment card, or paid storage is required for this mode. GitHub stores the catalogue metadata, not large movie files. Video bytes remain hosted by the authorised media provider. An optional `CINEMA_MEDIA_HOSTS` Worker variable can extend the default host allowlist with comma-separated hostnames; do not add a host until its rights and reliability have been checked.

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

The example is a schema illustration only and is not a real title or a rights determination. Replace every field with verified information. The committed `cinema/catalog.json` starts with an empty `items` array intentionally; do not add sample or fabricated films.

## Rights review checklist per title

- Confirm the specific film/version, soundtrack, subtitles and poster are covered.
- Confirm the public-domain status or licence in the territories where the service is offered.
- Confirm the licence permits hosting/streaming from USAMARKET, not merely personal viewing or linking.
- Confirm the source permits the intended commercial context and advertising, if ads are enabled.
- Save a stable rights-evidence URL and a copy of the evidence in the project's internal records.
- If any point is unclear, do not publish the title.

## Operational notes

- Do not upload copyrighted films based only on their presence on an archive website.
- Do not commit large movie files to the Git repository; GitHub is being used for catalogue metadata, not video hosting.
- The current API is read-only by design. Edit the GitHub `cinema/catalog.json` file to publish reviewed titles. A populated KV catalogue remains supported as an optional override.
- The current catalogue will correctly show an empty state until an allowlisted media hostname and verified catalogue records are configured.
