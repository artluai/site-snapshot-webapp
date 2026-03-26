# site-snapshot-app — Project Rules

## What this is

Consumer-facing web app for freezing any website into a single HTML file. Three modes: Free (client-side fetch), AI (Claude API rebuild), AI + Screenshot (image upload → Claude). Stripe for credit purchases, Firebase for auth + credits. Deployed on Netlify.

Domain: TBD (Netlify subdomain for now)
GitHub: github.com/artluai/site-snapshot-app

## Working Process

- Never make code changes without confirming first
- Show mockups/visuals before building
- Don't spend lots of tokens without checking in
- Ask before building, not after
- Always give changed files only, or a full zip when multiple files change
- Test locally with npm run dev before pushing
- Deploy via GitHub Desktop → Netlify auto-deploys

## Design System

- Fonts: Space Grotesk (headlines, buttons), DM Sans (body text)
- Background: #fafafa
- Text: #1a1a1a
- Muted text: #666, #888, #999, #bbb
- Primary accent: #1a1a1a (dark pills, buttons)
- AI/premium accent: #7c5cfc (purple)
- Success/free: #22c55e / #c4f5e1 (mint green)
- Warning: #f59e0b / #fef3a0 (yellow)
- Error: #ff6b6b
- Border: #eee
- Card background: #fff
- Card radius: 20px
- Button radius: 50px (pills) or 14px (action buttons)
- All interactive elements use pills with Space Grotesk 700
- Inline styles with const S = {} — no CSS modules or styled-components

## Component Structure

```
src/
  App.jsx              — main orchestrator, all state lives here
  firebase.js          — Firebase config (env vars)
  components/
    Nav.jsx            — logo, credits badge, sign in/out
    Hero.jsx           — headline + scanner animation
    AuthModal.jsx      — Google sign-in modal
    InputCard.jsx      — URL field, 3 modes, compat grid, examples, upload zones
    ResultsPanel.jsx   — all result states (HN, free-success, blocked, AI, upload)
    Pricing.jsx        — 3-tier pricing cards
    Features.jsx       — dark feature grid
    Footer.jsx
    Toast.jsx
  lib/                 — (TODO) business logic
    snapshot-free.js   — client-side fetch + HTML cleaning
    credits.js         — Firestore credit read/check/deduct
    stripe.js          — create checkout session
netlify/
  functions/           — serverless functions
    snapshot-ai.js     — Claude API call (TODO)
    create-checkout.js — Stripe checkout session (TODO)
    stripe-webhook.js  — Stripe payment confirmation (TODO)
    fetch-proxy.js     — CORS proxy for free mode (TODO)
```

## Architecture

- Single-page app, no routing needed — all sections on one page
- State flows down from App.jsx via props
- Auth state: user object + credits count
- Mode state: 'quick' | 'ai' | 'upload'
- Result state: { type, host } — determines which result panel shows
- Firebase Auth for Google sign-in
- Firestore schema: users/{uid} → { email, credits, freeUsedToday, createdAt }
- Stripe Checkout (hosted by Stripe, not us) for payments
- Stripe webhook → Firestore credit write
- Free mode: Netlify function proxies the fetch (CORS), browser cleans the HTML
- AI mode: Netlify function → Claude API with site-snapshot skill prompt
- Screenshot mode: base64 upload → Netlify function → Claude API

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Note: Netlify functions use Firebase Admin SDK which bypasses these rules. The rules protect against browser console manipulation only.

## Env Vars

Client-side (in .env, prefixed VITE_):
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

Server-side (Netlify dashboard only):
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- FIREBASE_SERVICE_ACCOUNT (JSON string)

## Pricing

- Free: 1 basic snapshot per day, client-side only
- Starter: $9.99 for 5 AI credits ($2 each)
- Pro Pack: $29.99 for 20 AI credits ($1.50 each)
- Credits never expire
- AI cost: ~$0.05 per snapshot (Claude Sonnet, ~2K in + 4K out tokens)

## Current Status

- All visual components: DONE
- Scanner animation on hero: DONE
- Mode switching (Free/AI/Screenshot): DONE
- Compat grid + example cards: DONE
- Blocked stamp overlay for SPA URLs: DONE
- Upload zones with drag-drop: DONE
- Pricing cards: DONE

TODO (in order):
1. Real Firebase Auth (swap simulated sign-in for signInWithPopup)
2. Firestore credit system (read/write per user)
3. Free mode fetch proxy (Netlify function for CORS)
4. Free mode HTML cleaning (client-side, strip scripts/tracking, inline CSS)
5. AI mode Netlify function (Claude API + snapshot skill prompt)
6. Screenshot mode (file upload → base64 → Claude)
7. Stripe checkout + webhook
8. Deploy to Netlify

## Commands

- npm run dev — run locally
- npm run build — production build
- Deploy: push to GitHub → Netlify auto-deploys

## Hard Rules

- Never reveal the human's identity, personal details, or other business names/assets
- Inline styles with const S = {} — same pattern as artlu.ai
- No new font families — Space Grotesk + DM Sans only
- Card radius is 20px, pill radius is 50px, action button radius is 14px
- Purple (#7c5cfc) is for AI/premium features only. Free features use green/mint.
- Every feature should work in public view first
- Server-side credit check before any AI call — never trust the client
- Stripe webhook signature verification — never trust unverified payment notifications
- API keys encrypted at rest if stored in Firestore (AES-256-GCM)
