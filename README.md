# site-snapshot-app

Consumer-facing web app for the site-snapshot Claude skill. Paste a URL, get a frozen HTML copy.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env`
3. Fill in your Firebase config:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
4. `npm run dev` to run the frontend locally
5. `npm run worker` to run the worker locally when testing AI jobs

## Deploy

Push to GitHub → connect to Netlify → auto-deploys.

Env vars needed on Netlify:
- `ANTHROPIC_API_KEY` — for AI snapshot generation
- `STRIPE_SECRET_KEY` — for credit purchases
- `STRIPE_WEBHOOK_SECRET` — for payment confirmation
- `FIREBASE_SERVICE_ACCOUNT` — JSON string for admin SDK in functions
- All `VITE_FIREBASE_*` vars above

New job-pipeline vars:
- `WORKER_URL` — Cloud Run worker base URL
- `WORKER_SHARED_SECRET` — shared secret sent from Netlify / Cloud Tasks to the worker
- `CLOUD_TASKS_PROJECT_ID` — GCP project id for durable worker dispatch
- `CLOUD_TASKS_LOCATION` — Cloud Tasks queue region
- `CLOUD_TASKS_QUEUE` — Cloud Tasks queue name
- `ALLOW_DIRECT_WORKER_DISPATCH=true` — optional local/dev fallback when Cloud Tasks is not configured

## Job Pipeline

AI URL snapshots no longer return the HTML directly from the request path.

New flow:
1. Frontend creates a Firestore job via `create-job`
2. Netlify reserves the credit and queues the worker
3. The worker captures the site and uploads the final HTML to object storage
4. Firestore stores progress + result metadata
5. Frontend subscribes to the job and loads a signed artifact URL when the file is ready

This is the foundation for larger outputs and longer runtimes.

Supported job types in the repo now:
- `browser_html` — URL capture through a real browser worker
- `vision_rebuild` — screenshot upload -> vision model -> HTML artifact

## Worker Deploy

The worker is packaged from [worker/Dockerfile](/Users/ralphxu/Documents/Projects/site-snapshot-webapp/worker/Dockerfile).

Minimum worker env vars:
- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_STORAGE_BUCKET`
- `BROWSERLESS_API_KEY` for URL capture jobs
- `ANTHROPIC_API_KEY` for screenshot rebuild jobs
- `WORKER_SHARED_SECRET`

For local dev without Cloud Tasks:
1. Run `npm run worker`
2. Set `WORKER_URL=http://localhost:8080`
3. Set `ALLOW_DIRECT_WORKER_DISPATCH=true`

## Cloud Run Deploy

1. Put your secrets into Google Secret Manager:
   - `FIREBASE_SERVICE_ACCOUNT`
   - `BROWSERLESS_API_KEY`
   - `ANTHROPIC_API_KEY`
2. Set local shell vars:
   - `GCP_PROJECT_ID`
   - `GCP_REGION`
   - `WORKER_SERVICE_NAME`
   - `WORKER_SHARED_SECRET`
   - `FIREBASE_STORAGE_BUCKET`
3. Run:
   - `bash worker/deploy.sh`
4. Copy the deployed Cloud Run URL into Netlify as `WORKER_URL`

## Firebase Access Rules

Your frontend now depends on live reads of:
- `users/{uid}`
- `users/{uid}/jobs/{jobId}`

At minimum, your Firestore rules should allow each signed-in user to read their own user doc and jobs, while only server code writes credits/job state.

Your Firebase Storage rules should allow users to upload only into:
- `users/{uid}/jobs/{jobId}/inputs/...`

and should block direct reads of final artifacts if you want downloads to go only through signed URLs.

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
