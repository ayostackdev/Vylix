#!/bin/bash
set -euo pipefail

echo "=== Vylix Contabo VPS Deployment ==="

# Compose files to deploy. Base file only (lean API):
#   bash deploy.sh
# Full-weight API with self-hosted BGE-M3 (see docker-compose.contabo.yml):
#   COMPOSE_FILES="docker-compose.prod.yml docker-compose.contabo.yml" bash deploy.sh
COMPOSE_FILES="${COMPOSE_FILES:-docker-compose.prod.yml}"
read -ra COMPOSE_FILE_LIST <<< "$COMPOSE_FILES"
COMPOSE_ARGS=()
for f in "${COMPOSE_FILE_LIST[@]}"; do
    COMPOSE_ARGS+=(-f "$f")
done
# Populated after .env.production is read: enables the coturn profile when a
# TURN secret is configured.
TURN_ARGS=()

# Update system
echo "[1/6] Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER" || true
    echo "Docker installed. You may need to log out and back in."
fi

# Install Docker Compose
echo "[3/6] Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt install -y docker-compose-plugin
fi

# The Docker group only applies to new login shells, so a user who just
# installed Docker cannot reach the daemon yet. Fall back to sudo.
# Use `sudo env VAR=... docker` rather than plain `sudo docker`: sudo's
# env_reset would otherwise drop the compose interpolation variables
# (API_WORKERS, *_MEM_LIMIT, CELERY_CONCURRENCY, ...) set inline before
# `bash deploy.sh`, silently reverting the overlay to its defaults.
DOCKER=(docker)
if ! docker info &> /dev/null; then
    echo "Docker daemon not reachable as '$USER' — using sudo for this run."
    DOCKER=(sudo env)
    for var in API_WORKERS API_MEM_LIMIT API_MEM_RESERVATION \
               WORKER_MEM_LIMIT WORKER_MEM_RESERVATION REDIS_MEM_LIMIT \
               BEAT_MEM_LIMIT CADDY_MEM_LIMIT CELERY_CONCURRENCY \
               FLOWER_MEM_LIMIT TURN_MEM_LIMIT; do
        if [ -n "${!var:-}" ]; then
            DOCKER+=("$var=${!var}")
        fi
    done
    DOCKER+=(docker)
fi

compose() {
    "${DOCKER[@]}" compose "${COMPOSE_ARGS[@]}" "${TURN_ARGS[@]}" "$@"
}

# Clone repo
echo "[4/6] Cloning repository..."
if [ ! -d "/opt/vylix" ]; then
    sudo git clone https://github.com/ayostackdev/Vylix.git /opt/vylix
    sudo chown -R "$USER:$USER" /opt/vylix
    git config --global --add safe.directory /opt/vylix
else
    cd /opt/vylix && git pull
fi

cd /opt/vylix

# Create .env.production if it doesn't exist
echo "[5/6] Setting up environment..."
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    echo ">>> Edit /opt/vylix/.env.production with your production values <<<"
    echo ">>> Then run: docker compose ${COMPOSE_ARGS[*]} up -d <<<"
    exit 0
fi

# Deploy
echo "[6/6] Starting services..."
echo "Compose files: ${COMPOSE_FILES}"

# Start coturn only when TURN is configured. `WEBRTC_TURN_SECRET` is the
# single source of truth for both the API's HMAC credentials and coturn.
TURN_SECRET_VALUE="$(grep -E '^WEBRTC_TURN_SECRET=' .env.production | tail -n1 | cut -d= -f2- | tr -d '"' || true)"
if [ -n "$TURN_SECRET_VALUE" ]; then
    TURN_ARGS+=(--profile turn)
    echo "TURN enabled (coturn profile)."
    echo "Open 3478/udp, 3478/tcp, and 49160-49300/udp in the Contabo firewall."
fi

compose down
# No --no-cache: Docker's layer cache already invalidates on changed COPY
# layers, and forcing a rebuild re-pulls torch/docling (~20 min for the
# full-weight API image).
compose build

# One-shot migration BEFORE the API starts — never inside the container CMD,
# or concurrent replicas would race alembic on every deploy.
echo "Running database migrations..."
compose run --rm api alembic upgrade head

compose up -d

echo ""
echo "=== Deployment Complete ==="
echo "API: https://api.vylix.app"
echo "Docs: https://api.vylix.app/docs"
echo ""
echo "View logs: docker compose ${COMPOSE_ARGS[*]} ${TURN_ARGS[*]} logs -f"
echo "Restart: docker compose ${COMPOSE_ARGS[*]} restart"
