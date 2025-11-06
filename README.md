# City Rehab Home Care Performance Dashboard

Interactive analytics dashboard purpose-built for City Rehab's home care physical therapy operations. The dashboard loads live data directly from the Google Sheets published datasets and turns them into actionable metrics, visualizations, and filterable tables.

## Features

- Auto-refreshes directly from the live Google Sheets on every load or when you hit **Refresh Data**
- KPI ribbon summarising patient volume, therapist coverage, attendance, and lead health
- Lead coverage view with enlarged charts, territory watchlists, and provider momentum call-outs
- 12-week scheduling velocity line chart with attendance overlay
- Guided recommendations and operational insights generated from live metrics
- Filterable patient directory (area, provider, appointment type, date range, lead source, and more) that adapts to any header or column updates in the Google Sheet
- Quick JSON snapshot export for saving the current metrics state
- Bundled CORS fallback so the dashboard still works when opened from `file://` (no local server required)

## Data Sources

The dashboard ingests the following City Rehab Google Sheets that are already published to the web:

- **PatientData**: `https://docs.google.com/spreadsheets/d/e/2PACX-1vScmziN6Fn9hIVXXTk0TP8za3xpjYHRIg_Rb5OiLJEajJWLVGlkevqTNZg6sVCkV8CdDqVxwy9ecs9T/pub?gid=787326170&single=true&output=csv`
- **Numbers**: `https://docs.google.com/spreadsheets/d/e/2PACX-1vScmziN6Fn9hIVXXTk0TP8za3xpjYHRIg_Rb5OiLJEajJWLVGlkevqTNZg6sVCkV8CdDqVxwy9ecs9T/pub?gid=798148881&single=true&output=csv`
- **Appointments**: `https://docs.google.com/spreadsheets/d/e/2PACX-1vScmziN6Fn9hIVXXTk0TP8za3xpjYHRIg_Rb5OiLJEajJWLVGlkevqTNZg6sVCkV8CdDqVxwy9ecs9T/pub?gid=1682303995&single=true&output=csv`

You can continue updating those sheets (including renaming columns or adding new ones); the dashboard pulls the latest structure and values on every refresh.

## Quick Start

1. Download or clone this folder.
2. Open `index.html` in your browser.
3. The dashboard will fetch the Google Sheets data and render the visuals automatically.

## Connectivity Notes

- When opened from a local `file://` URL, the app automatically routes Google Sheets requests through a public CORS proxy so browsers allow the download.
- When hosted from any `https://` origin (GitHub Pages, Netlify, etc.), the dashboard talks to Google Sheets directly without the proxy layer.
- GitHub Pages is case-sensitive and serves from the repository root. Ensure `app.js` and `style.css` sit alongside `index.html` (as in this folder) when you push.

## Customization

- Update the color palette or layout in `style.css`.
- Extend the dashboard logic or KPIs inside `app.js`.
- Replace the data source URLs in `app.js` if the sheets move.

## Deployment

Since this is a static site, you can host it on GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static hosting provider. Keep `index.html`, `app.js`, and `style.css` in the repository root so GitHub Pages resolves the paths without 404s. No server-side code is required.

## Credits

Designed by Codex for City Rehab to modernize visibility into patient pipeline, scheduling operations, and revenue-critical insurance workflows.
