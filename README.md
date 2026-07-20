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

## Local testing (optional, if you want to preview before deploying)

```
npm install
npm run dev
```
