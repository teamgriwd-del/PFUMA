# PFUMA — WebView Mobile App

A **thin native shell around the real PFUMA web app** — not a second implementation of the UI. This exists because the old `app/` folder (kept as-is, untouched) is a fully separate React Native codebase with its own screens that constantly drift out of sync with the web app: every backend feature has to be hand-rebuilt twice, and things quietly fall behind (e.g. the Messenger screen there is still the old hardcoded demo mock the web app moved past). This project has no screens of its own — it's one `WebView` pointing at the web app, so there is exactly one UI to build and test.

## How it works

`App.js` is a single `WebView` loading `WEB_URL` (see `config.js`), plus:
- A loading spinner while the page loads.
- A friendly retry screen if the web app can't be reached, instead of a blank native error page.
- Android hardware back button navigates the web app's own history before falling through to exiting the app.
- `domStorageEnabled` so the web app's login session (stored in `localStorage`) actually persists.

## Running it

1. Start the real PFUMA backend and web app (see the root `SETUP.md`):
   ```
   cd ../backend && python app.py
   cd .. && npm run dev
   ```
2. Edit `config.js` — `WEB_URL` must be your PC's LAN IP (not `localhost`) if you're testing on a physical device, since the phone is a separate device on the network. Find it with `ipconfig`. An emulator/simulator can usually use `localhost`.
3. `npx expo start` and open in Expo Go, an emulator, or a dev build.

Before a real deployment, point `WEB_URL` at the hosted production URL instead of a dev server.

## Responsive pass — done

The web app's layout used to be desktop-only (a fixed always-visible sidebar, bare 3/4-column grids with no mobile fallback, a two-pane login screen that didn't stack). That's fixed now, in the web app itself, not in this wrapper — which is the whole point of this architecture: fixing it once at the source fixes it here for free. Verified at a 390px-wide viewport (iPhone-sized) across every major screen: the sidebar becomes a hamburger-triggered drawer, dashboard/vital-card grids stack to 1 column, the Messenger becomes a proper master-detail view (list OR chat, not squeezed side-by-side), and the login/registration flow is fully usable end to end. Desktop was re-checked after each change and is unaffected.

## What this app intentionally does NOT have

Native push notifications (e.g. for theft/fever alerts) don't work well through a plain WebView — if that's wanted, it needs a small native piece added on top of this (e.g. Expo push notifications triggered by a backend webhook), not a webpage feature. Camera/file-input based features (like the photo disease-check) should work through the WebView's native file picker without extra code, but haven't been verified on a physical device yet.
