# Inputr landing page

Static HTML / CSS / vanilla JS. No build step.

## Local preview

```bash
npx --yes http-server landing -p 4321 -c-1 -o
```

## Deploy

Vercel is configured at the repo root (`vercel.json`) to serve **only this
directory**. Connect the repo to a Vercel project and it will:

- Skip the install / build (the extension uses WXT and shouldn't be built
  by Vercel)
- Serve the contents of `landing/` as a static site

No env vars, no secrets, no framework detection.

## Structure

```
landing/
├── index.html      # the page
├── styles.css      # all styles (Poppins + JetBrains Mono via Google Fonts)
├── script.js       # IntersectionObserver reveal + sticky-nav border
└── favicon.svg     # brand mark
```

## Brand

- Orange `#fd6d2c`
- Warm white `#f6f4f0`
- Warm black `#1a1612`
- Type: Poppins (display + body), JetBrains Mono (mono accents)
