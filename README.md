
# n8n on Google Cloud Platform (Free Tier)

Self-hosted n8n workflow automation on GCP's Always Free tier.

## Quick Start

### Prerequisites
- Google Cloud account with billing enabled (free tier, won't be charged)
- A domain name (optional but recommended for SSL)

### 1. Create GCP VM

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Navigate to **Compute Engine > VM Instances > Create Instance**

**CRITICAL Settings for Free Tier:**
```
Name:         n8n-server
Region:       us-central1 (or us-west1, us-east1)
Machine type: e2-micro (MUST be e2-micro)
Boot disk:    Ubuntu 22.04 LTS, 30GB standard
Firewall:     Allow HTTP and HTTPS
```

4. Note the External IP after creation

### 2. Set Up the VM

SSH into your VM (click "SSH" button in GCP Console), then run:

```bash
# Download and run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/n8n/scripts/setup-vm.sh | bash
```

Or copy files manually:
```bash
# From your local machine
scp -r infrastructure/* YOUR_USERNAME@VM_EXTERNAL_IP:~/n8n-docker/
```

### 3. Configure n8n

On the VM:
```bash
cd ~/n8n-docker

# Edit configuration
cp .env.example .env
nano .env  # Set your domain and generate a secure password

# Start n8n
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 4. Configure SSL (Recommended)

Edit `/etc/caddy/Caddyfile`:
```
n8n.yourdomain.com {
    reverse_proxy localhost:5678
}
```

```bash
sudo systemctl restart caddy
```

### 5. Access n8n

- With domain: `https://n8n.yourdomain.com`
- Without domain: `http://VM_EXTERNAL_IP:5678`

## Directory Structure

```
n8n/
├── README.md              # This file
├── infrastructure/
│   ├── docker-compose.yml # n8n container config
│   ├── .env.example       # Environment template
│   └── Caddyfile          # SSL reverse proxy config
├── scripts/
│   ├── setup-vm.sh        # VM setup automation
│   └── backup.sh          # Backup script
├── workflows/             # Exported n8n workflows (JSON)
└── docs/
    └── N8N_GCP_SETUP_GUIDE.md  # Detailed setup guide
```

## Common Commands

```bash
# Start n8n
cd ~/n8n-docker && docker-compose up -d

# Stop n8n
docker-compose down

# View logs
docker-compose logs -f

# Update n8n
docker-compose pull && docker-compose down && docker-compose up -d

# Manual backup
~/n8n-docker/backup.sh
```

## Free Tier Limits

| Resource | Limit |
|----------|-------|
| VM | 1x e2-micro (us-central1, us-west1, or us-east1) |
| Disk | 30GB standard persistent |
| Egress | 1GB/month to most destinations |
| Static IP | Free while attached to running VM |

## Documentation

See [docs/N8N_GCP_SETUP_GUIDE.md](docs/N8N_GCP_SETUP_GUIDE.md) for the complete setup guide.
=======
# n8n_workflows
Private repo for n8n workflows

