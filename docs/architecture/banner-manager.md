# Shinext Banner Manager — Firebase-ready model

## Purpose
Allow Shinext to create, schedule and place multiple campaign banners without editing public page markup.

## Banner document
Recommended Firestore collection: `banners/{bannerId}`

```json
{
  "id": "distribuidores-01",
  "type": "distributor",
  "placement": "distributor",
  "title": "¿Eres distribuidor de productos de limpieza?",
  "text": "Buscamos alianzas con proveedores.",
  "cta": "Contáctanos",
  "href": "https://wa.me/522291437041",
  "image": null,
  "active": true,
  "audience": "both",
  "device": "all",
  "startsAt": null,
  "endsAt": null,
  "priority": 10,
  "campaignId": "proveedores-2026"
}
```

## Supported placements
- `hero`
- `services`
- `cta`
- `blog`
- `distributor`

The public renderer must show only active records whose placement and device target match the visitor.

## Future security model
- Admin/operations/reviewer roles may create and update banners.
- Public visitors may read only publishable/active banner data.
- Campaign editing must never expose Firebase administrative credentials in the browser.
- Storage images should use controlled public/read URLs or Firebase-hosted assets as appropriate.

## Analytics
Every displayed banner receives `banner_impression`; clicks receive `banner_click`. Include `banner_id`, `banner_type`, `banner_placement`, `campaignId` and `page_location` so campaign performance can later be analyzed in GA4/Google Ads/Firebase analytics.