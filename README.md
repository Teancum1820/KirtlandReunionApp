# Kirtland Together

A mobile-first PWA for 2026 family reunions in Kirtland, Ohio. The app provides:

- Family and group-specific schedules
- Installable, offline-capable attendee experience
- Interactive Kirtland map with site, restroom, food, and parking filters
- Searchable member-to-group assignments
- Automated GitHub Pages deployment

Created by the Kirtland Heritage Group 2026.

## Reunion data

The app currently includes only the Artemus Millett / Millet Family reunion.
Member assignments and group site visits are loaded from:

- `data/Millet Family Groups.csv`
- `data/Milliet Group Scheduels.csv`
- `data/millet Public Events.html`

The public schedule is marked tentative in the attendee experience.

## Local development

```bash
npm install
npm run dev
```

The production build uses the GitHub Pages base path
`/KirtlandReunionApp/`.

```bash
npm run check
npm run build
npm run preview
```

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys every
push to `main`.

In the GitHub repository, open **Settings → Pages** and choose **GitHub
Actions** as the source.
