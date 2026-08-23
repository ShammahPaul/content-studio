# Content Studio

Gemini-powered draft generator for the social media pipeline — Story Team and Song-Sync Team batches, ready to copy into your approval workflow.

This was originally built as a Claude artifact (using Claude's built-in `window.storage`); this version swaps that for plain browser `localStorage` (see `src/storage.js`) so it runs as a normal static site anywhere, including GitHub Pages.

## Run it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Paste your Gemini API key into the Settings panel — it's saved to your browser's localStorage only (not sent anywhere except directly to Google's API from your browser).

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy to GitHub Pages (free, automatic)

1. In your repo on GitHub: **Settings → Pages → Source → GitHub Actions**.
2. If your repo name isn't `content-studio`, edit `vite.config.js` and set:
   ```js
   base: '/<your-repo-name>/',
   ```
   then commit and push.
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically on every push to `main`. Check the **Actions** tab for progress; your site will be live at:
   ```
   https://<your-username>.github.io/<your-repo-name>/
   ```

## About the API key

This app calls the Gemini API **directly from the browser** — there's no backend. That means:

- Your key lives in your own browser's localStorage, on your own device.
- It is **not safe to share this deployed URL publicly** with the key already filled in — anyone using the page could see network requests containing it. This is fine for personal/private use (bookmark it, only you use it), but don't post the link around.
- For a version where the key stays server-side and never touches the browser, the Gemini calls would need to move into the n8n backend instead (see the technical architecture doc) — this app is the manual/interactive counterpart to that automated pipeline, not a replacement for it.

## Files

- `src/App.jsx` — the app (Story Team + Song-Sync Team tabs, Gemini calls, history)
- `src/storage.js` — localStorage-backed persistence (swap this out if you later add a real backend/database)
- `.github/workflows/deploy.yml` — auto-deploy to GitHub Pages on push to `main`
