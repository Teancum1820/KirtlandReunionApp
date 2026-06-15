# Kirtland Together

A mobile-first PWA for 2026 family reunions in Kirtland, Ohio. The app provides:

- Family and group-specific schedules
- Installable, offline-capable attendee experience
- Interactive Kirtland map with site, shuttle, restroom, food, and parking filters
- Targeted shuttle departure and arrival notifications
- Organizer alert controls protected by Firebase Authentication
- Automated GitHub Pages deployment

## Reunion data

The app currently includes only the Artemus Millett / Millet Family reunion.
Member assignments and group site visits are loaded from:

- `data/Millet Family Groups.csv`
- `data/Milliet Group Scheduels.csv`
- `data/millet Public Events.html`

The public schedule is marked tentative in the attendee experience. Review the
sample help-line phone number in `src/App.tsx` before publishing.

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

Without Firebase variables, the site still builds and works as an offline PWA.
Notification permission can be tested locally, but remote shuttle alerts remain
disabled.

## Firebase push backend

GitHub Pages is static hosting, so remote Web Push requires a separate backend.
This repository includes Firebase Authentication, Cloud Messaging, Firestore,
and callable Cloud Functions in `functions/`.

1. Create a Firebase project and add a Web app.
2. Enable **Anonymous** and **Email/Password** providers in Authentication.
3. Enable Firestore and Cloud Messaging.
4. Create a Web Push certificate in Firebase Cloud Messaging settings.
5. Copy `.env.example` to `.env.local` and add the public web configuration.
6. Add the same values as GitHub Actions repository variables, using the names
   in `.github/workflows/deploy-pages.yml`.
7. Install and deploy the backend:

```bash
cd functions
npm install
npm run build
cd ..
npx firebase-tools login
npx firebase-tools use YOUR_PROJECT_ID
npx firebase-tools deploy --only functions,firestore:rules
```

Set the Cloud Functions `APP_URL` environment variable to:

```text
https://teancum1820.github.io/KirtlandReunionApp/
```

Create organizer users with Email/Password authentication. Organizer accounts
must also have the custom claim `{ admin: true }`; the callable function rejects
all other users.

## Notification targeting

Each attendee is anonymously authenticated and subscribed to three Firebase
Cloud Messaging topics:

- Everyone attending the reunion
- Their selected family
- Their selected schedule group

Organizer alerts can target any one of those levels. Device tokens are stored
only in Firestore documents inaccessible to browser clients.
