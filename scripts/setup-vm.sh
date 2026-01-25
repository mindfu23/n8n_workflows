#!/bin/bash

# n8n GCP VM Setup Script
# Run this script on a fresh Ubuntu 22.04 e2-micro VM
#
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_REPO/n8n/main/scripts/setup-vm.sh | bash
# Or: ./setup-vm.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo ""
echo "========================================"
echo "  n8n GCP VM Setup Script"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please run this script as a regular user, not root"
    exit 1
fi

# ===========================================
# Step 1: System Updates
# ===========================================
log_step "Step 1/7: Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ===========================================
# Step 2: Add Swap Space (critical for e2-micro)
# ===========================================
log_step "Step 2/7: Adding swap space (1GB)..."

if [ -f /swapfile ]; then
    log_info "Swap file already exists, skipping..."
else
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    log_info "Swap space added successfully"
fi

# Verify swap
free -h | grep -i swap

# ===========================================
# Step 3: Install Docker
# ===========================================
log_step "Step 3/7: Installing Docker..."

if command -v docker &> /dev/null; then
    log_info "Docker already installed: $(docker --version)"
else
    sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    sudo usermod -aG docker $USER
    log_info "Docker installed: $(docker --version)"
fi

# ===========================================
# Step 4: Install Docker Compose
# ===========================================
log_step "Step 4/7: Installing Docker Compose..."

if command -v docker-compose &> /dev/null; then
    log_info "Docker Compose already installed: $(docker-compose --version)"
else
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log_info "Docker Compose installed: $(docker-compose --version)"
fi

# ===========================================
# Step 5: Install Caddy (for SSL)
# ===========================================
log_step "Step 5/7: Installing Caddy..."

if command -v caddy &> /dev/null; then
    log_info "Caddy already installed: $(caddy version)"
else
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy
    log_info "Caddy installed: $(caddy version)"
fi

# ===========================================
# Step 6: Install Fail2ban
# ===========================================
log_step "Step 6/7: Installing Fail2ban..."

if command -v fail2ban-client &> /dev/null; then
    log_info "Fail2ban already installed"
else
    sudo apt install -y fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    log_info "Fail2ban installed and running"
fi

# ===========================================
# Step 7: Create n8n directory structure
# ===========================================
log_step "Step 7/7: Creating n8n directory structure..."

mkdir -p ~/n8n-docker/n8n_data
mkdir -p ~/n8n-backups

# Set correct permissions for n8n data directory
# n8n runs as user 1000 inside the container
sudo chown -R 1000:1000 ~/n8n-docker/n8n_data

log_info "Directory structure created"

# ===========================================
# Summary
# ===========================================
echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
log_info "Next steps:"
echo "  1. Copy docker-compose.yml to ~/n8n-docker/"
echo "  2. Copy .env.example to ~/n8n-docker/.env and edit it"
echo "  3. Configure Caddyfile at /etc/caddy/Caddyfile"
echo "  4. Start n8n: cd ~/n8n-docker && docker-compose up -d"
echo ""
log_warn "IMPORTANT: Log out and back in for Docker group membership to take effect"
echo ""
echo "Commands to copy files from your local machine:"
echo "  scp infrastructure/docker-compose.yml USER@VM_IP:~/n8n-docker/"
echo "  scp infrastructure/.env.example USER@VM_IP:~/n8n-docker/.env"
echo ""
