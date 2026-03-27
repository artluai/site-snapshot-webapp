#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GCP_PROJECT_ID:-}" ]]; then
  echo "Missing GCP_PROJECT_ID"
  exit 1
fi

if [[ -z "${GCP_REGION:-}" ]]; then
  echo "Missing GCP_REGION"
  exit 1
fi

if [[ -z "${WORKER_SERVICE_NAME:-}" ]]; then
  echo "Missing WORKER_SERVICE_NAME"
  exit 1
fi

if [[ -z "${WORKER_SHARED_SECRET:-}" ]]; then
  echo "Missing WORKER_SHARED_SECRET"
  exit 1
fi

if [[ -z "${FIREBASE_STORAGE_BUCKET:-}" ]]; then
  echo "Missing FIREBASE_STORAGE_BUCKET"
  exit 1
fi

gcloud run deploy "${WORKER_SERVICE_NAME}" \
  --source . \
  --region "${GCP_REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --allow-unauthenticated \
  --clear-base-image \
  --timeout 900 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "WORKER_SHARED_SECRET=${WORKER_SHARED_SECRET},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET},ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}" \
  --set-secrets "FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest,BROWSERLESS_API_KEY=BROWSERLESS_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"
