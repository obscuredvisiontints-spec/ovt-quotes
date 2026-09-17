# OVT Flat Glass Quotes

Your flat glass quoting tool, packaged as a real installable app (PWA).

## What changed from the artifact version

- Same app, same logic, same look — nothing about how it works has changed.
- Quotes now save to your phone/laptop's own storage (localStorage) instead of the
  Claude sandbox. They persist across visits, browser restarts, and offline use.
- Added a manifest + service worker so you can install it to your home screen
  and it'll open like a native app (own icon, no browser bar, works offline).

## Get it online (Vercel — free, ~5 minutes)

1. Go to https://vercel.com and sign up (GitHub login is easiest).
2. Go to https://github.com/new and create a new repository (e.g. `ovt-quotes`).
3. Upload this whole folder to that repo. Easiest way with no command line:
   - On the new repo page, click "uploading an existing file"
   - Drag every file/folder from this project in
   - Commit
4. Back in Vercel: **Add New → Project**, pick that repo, click **Deploy**.
   Vercel auto-detects Vite — no settings to change.
5. You'll get a live URL like `ovt-quotes.vercel.app`. That's your app, for good.

## Install it on your phone

- **iPhone:** open the URL in Safari → Share button → "Add to Home Screen"
- **Android:** open the URL in Chrome → menu (⋮) → "Install app" / "Add to Home screen"

It'll sit on your home screen with the teal hex icon and open full-screen, no
browser chrome.

## A few honest limitations to know about

- **Storage is per-device.** A quote saved on your phone won't show up on your
  laptop. If you want quotes to follow you across devices, that's the next
  step up (a real backend + database) — just say the word.
- **Photos still aren't saved with quotes** (same as before) — re-attach if
  you reload a saved quote.
- Free Vercel hosting has no meaningful traffic limits for a tool only you use.

## Connecting real QuickBooks invoice creation

The "Create QB Invoice" button needs a one-time setup on your end before it'll
work — I can't do this part for you since it requires your own QuickBooks
login. The CSV export next to it always works with zero setup, so you're not
blocked in the meantime.

**1. Create an Intuit developer app (free, ~5 min)**
1. Go to https://developer.intuit.com and sign up / log in.
2. Create a new app under "QuickBooks Online and Payments."
3. In the app's **Keys & Credentials** section, grab your **Client ID** and
   **Client Secret** (there are separate sandbox and production keys — start
   with sandbox for testing, switch to production keys once it's working).
4. Under **Redirect URIs**, add:
   `https://YOUR-VERCEL-DOMAIN/api/qb/callback`
   (use your actual `.vercel.app` domain, or custom domain if you set one up)

**2. Add a free Redis store (for storing the QuickBooks connection)**
1. In your Vercel project, go to the **Storage** tab.
2. Add a new **Upstash Redis** database (via the Marketplace integration — free
   tier is plenty for this). Connect it to your project.
3. Vercel will automatically add the right environment variables for you.

**3. Add these environment variables in Vercel** (Project → Settings →
Environment Variables):

| Name | Value |
|---|---|
| `QB_CLIENT_ID` | from Intuit developer app |
| `QB_CLIENT_SECRET` | from Intuit developer app |
| `QB_REDIRECT_URI` | `https://YOUR-VERCEL-DOMAIN/api/qb/callback` |
| `QB_ENVIRONMENT` | `sandbox` to test, `production` once it's working |

4. Redeploy after adding these (Vercel → Deployments → Redeploy) so they take
   effect.

**4. Connect it**
- Open the app, tap **Connect QuickBooks**, log into your QuickBooks account
  when prompted, and approve access. You'll land back in the app connected.

**5. One thing to know before your first invoice**
- Every line item (film install, add-ons, caulking, travel, discount, tax)
  needs a matching **Product/Service** already set up in QuickBooks with that
  exact name — same requirement as the CSV export. If one's missing, the app
  will tell you exactly which name to add before trying again.

## Local testing (optional, if you want to preview before deploying)

```
npm install
npm run dev
```
