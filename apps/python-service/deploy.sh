#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT}}"
REGION="${2:-us-central1}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Usage: $0 <project-id> [region]"
  echo "Or set GOOGLE_CLOUD_PROJECT env var"
  exit 1
fi

echo "=== Deploying Python service to Cloud Run ==="
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"

SERVICE_NAME="vylix-python-service"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/vylix/${SERVICE_NAME}"

echo ""
echo "Step 1: Build & push to Artifact Registry..."
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --config=cloudbuild.yaml \
  --substitutions=_REGION="${REGION}"

echo ""
echo "Step 2: Deploy Celery worker (separate Cloud Run service)..."
gcloud run deploy "${SERVICE_NAME}-worker" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE}:latest" \
  --command="celery" \
  --args="-A,app.core.celery_app.celery_app,worker,--loglevel=info,--concurrency=2" \
  --memory=2Gi \
  --cpu=2 \
  --max-instances=3 \
  --no-allow-unauthenticated \
  --set-env-vars=ENVIRONMENT=production \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,POSTGRES_DSN=postgres-dsn:latest,CELERY_BROKER_URL=celery-broker-url:latest,CELERY_RESULT_BACKEND=celery-result-backend:latest

echo ""
echo "=== Done ==="
echo "Web:  https://${SERVICE_NAME}-${PROJECT_ID}.${REGION}.run.app"
echo "Worker: ${SERVICE_NAME}-worker"
