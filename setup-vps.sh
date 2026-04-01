#!/bin/bash
# =============================================================================
# PrivateGPT VPS Setup Script
# =============================================================================
# Run on a fresh Ubuntu 22.04+ VPS:
#   curl -sSL https://raw.githubusercontent.com/mbelenkiy29/privai/demov3/setup-vps.sh | bash
#
# Or after cloning:
#   bash setup-vps.sh
# =============================================================================

set -e

echo "============================================"
echo "  PrivateGPT VPS Setup"
echo "============================================"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "[1/5] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo systemctl enable docker
    sudo systemctl start docker
else
    echo "[1/5] Docker already installed."
fi

# Ensure current user can run docker
if ! docker ps &> /dev/null; then
    sudo usermod -aG docker "$USER"
    echo "Added $USER to docker group. If docker commands fail, log out and back in."
fi

# Clone repo if not already in it
if [ ! -f "Dockerfile.allinone" ]; then
    echo "[2/5] Cloning repository..."
    git clone -b demov3 https://github.com/mbelenkiy29/privai.git
    cd privai
else
    echo "[2/5] Already in repo directory."
fi

# Create .env from template
if [ ! -f ".env" ]; then
    echo "[3/5] Creating .env from template..."
    cp .env.template .env
else
    echo "[3/5] .env already exists, skipping."
fi

# Build and start
echo "[4/5] Building and starting services (this takes 5-10 minutes on first run)..."
docker compose -f docker-compose.prod-simple.yml up -d --build

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Your app is starting up at:"
echo "  http://${SERVER_IP}:3000"
echo ""
echo "  It may take 1-2 minutes for all services"
echo "  to initialize (database migrations, etc)."
echo ""
echo "  View logs:  docker compose -f docker-compose.prod-simple.yml logs -f app"
echo "  Stop:       docker compose -f docker-compose.prod-simple.yml down"
echo "  Restart:    docker compose -f docker-compose.prod-simple.yml restart app"
echo ""
