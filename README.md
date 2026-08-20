# DoCW Treasure Hunt — Jigsaw Puzzle

A mobile-first jigsaw puzzle for the DoCW Pre-Induction Event **TREASURE HUNT**.
Portrait photo, 3×4 grid (12 pieces), tap-to-swap controls, count-up timer.
Designed to be solvable in under 2 minutes. No backend, no tracking.

## Add your photo

Replace `puzzle.jpg` with your portrait photo (keep the filename `puzzle.jpg`,
ideally 3:4 aspect ratio, e.g. 900×1200). If the file is missing, a placeholder
is shown automatically.

## Run locally

Just open `index.html` in a browser, or:

```
npx serve .
```

## Deploy to Vercel

Option A (dashboard): go to vercel.com → Add New Project → import/drag this folder → Deploy.

Option B (CLI):

```
npm i -g vercel
vercel --prod
```

It's a fully static site — no build settings needed.

## Customize

- Grid size: change `COLS` / `ROWS` at the top of `app.js`
  (also update `aspect-ratio` and `background-size` in `style.css` if you change them).
- Event title: edit `<h1>` in `index.html`.
