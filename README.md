# site-snapshot-app

Consumer-facing web app for the site-snapshot Claude skill. Paste a URL, get a frozen HTML copy.

## Setup

1. `npm install`
2. Create `.env` with your Firebase config:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
3. `npm run dev` to run locally

## Deploy

Push to GitHub → connect to Netlify → auto-deploys.

Env vars needed on Netlify:
- `ANTHROPIC_API_KEY` — for AI snapshot generation
- `STRIPE_SECRET_KEY` — for credit purchases
- `STRIPE_WEBHOOK_SECRET` — for payment confirmation
- `FIREBASE_SERVICE_ACCOUNT` — JSON string for admin SDK in functions
- All `VITE_FIREBASE_*` vars above

## Stack

- React + Vite
- Firebase Auth (Google) + Firestore
- Netlify Functions
- Stripe (credit packs)
- Claude API (AI snapshots)

## Structure

```
src/
  App.jsx              — main orchestrator, state management
  firebase.js          — Firebase config
  components/
    Nav.jsx            — logo, credits, sign in/out
    Hero.jsx           — headline + scanner animation
    AuthModal.jsx      — Google sign-in modal
    InputCard.jsx      — URL field, modes, compat grid, examples, upload
    ResultsPanel.jsx   — HN success, Linear blocked/AI, preview frames
    Pricing.jsx        — 3-tier pricing cards
    Features.jsx       — dark feature grid
    Footer.jsx
    Toast.jsx
netlify/
  functions/           — serverless functions (TODO)
```
