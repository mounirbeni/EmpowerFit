# EmpowerFit Dashboards — Setup

The site now includes two dashboards, both powered by the existing **Netlify Forms** data:

- **Coach Login** (`/#admin`) — review every coaching request, contact message, and newsletter signup. Searchable and filterable.
- **Client Portal** (`/#client`) — a client enters the email they used in the questionnaire to see their request status, profile summary, and message history.

Both are linked from the footer under **Company**.

## How it works

Netlify Forms keeps collecting submissions exactly as before. A small Netlify serverless
function (`netlify/functions/get-submissions.js`) reads them through the Netlify API. The
API token stays on the server, so nothing sensitive is exposed in the public page.

## Required configuration (one time)

In **Netlify → Site settings → Environment variables**, add these two secrets:

| Variable | Where to get it |
| --- | --- |
| `ADMIN_PASSWORD` | Any password you choose. The coach types this on the Coach Login screen. |
| `NETLIFY_API_TOKEN` | Netlify → User settings → Applications → **New access token**. |

After saving, trigger a redeploy. The dashboards will start loading live data.

> The Site ID (`c956d8d3-5f3c-4063-bcb8-a7926ff88779`) is already baked into the
> function, so you don't need to set `NETLIFY_SITE_ID`. You can still override it
> with an env var if the site ever changes.

> Until these are set, the dashboards load but show a friendly
> "Dashboard is not configured yet" message.

## Notes & next steps

- The client lookup is by email only, so it's meant as a lightweight status portal, not a
  secure account area. If you later want true client accounts (passwords, private plans),
  the natural upgrade is Netlify Identity or Firebase Auth — happy to wire that up.
- Local `netlify dev` will run the function locally if you have the Netlify CLI installed
  and the same environment variables set.
