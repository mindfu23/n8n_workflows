# n8n on Google Cloud Platform (Free Tier) - Implementation Guide

> **For:** Claude Opus 4.5 Agent implementing from user's local GitHub repository  
> **Purpose:** Deploy n8n workflow automation backend for a Shamanic Guide application  
> **Cost:** Free (using GCP Always Free tier)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Phase 1: GCP Account & Project Setup](#3-phase-1-gcp-account--project-setup)
4. [Phase 2: Create Free Tier VM](#4-phase-2-create-free-tier-vm)
5. [Phase 3: Server Configuration](#5-phase-3-server-configuration)
6. [Phase 4: Install & Run n8n](#6-phase-4-install--run-n8n)
7. [Phase 5: Security & Firewall](#7-phase-5-security--firewall)
8. [Phase 6: Domain & SSL (Optional but Recommended)](#8-phase-6-domain--ssl-optional-but-recommended)
9. [Phase 7: n8n Configuration for Shamanic Guide](#9-phase-7-n8n-configuration-for-shamanic-guide)
10. [Phase 8: Frontend Integration](#10-phase-8-frontend-integration)
11. [Phase 9: Backup & Version Control](#11-phase-9-backup--version-control)
12. [Troubleshooting](#12-troubleshooting)
13. [Maintenance Procedures](#13-maintenance-procedures)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   [User Browser]                                                     │
│        │                                                             │
│        ▼                                                             │
│   [Netlify / Vercel]  ◄── GitHub auto-deploy                        │
│   Frontend (React/HTML)                                              │
│   - Shamanic Guide UI                                                │
│   - Journey selection                                                │
│   - Oracle card interface                                            │
│        │                                                             │
│        │ HTTPS API calls                                             │
│        ▼                                                             │
│   [Google Cloud VM - e2-micro]                                       │
│   n8n Workflow Engine                                                │
│   - Webhook endpoints                                                │
│   - AI orchestration logic                                           │
│   - Response formatting                                              │
│        │                                                             │
│        ▼                                                             │
│   [External AI APIs]                                                 │
│   - Anthropic Claude API                                             │
│   - OpenAI GPT-4 API                                                 │
│   - Stability AI / DALL-E                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend Host | Netlify | Free, auto-deploys from GitHub, global CDN |
| Backend (n8n) | GCP e2-micro | Free tier, reliable, good network |
| Workflow Tool | n8n | Visual builder, all AI integrations, free self-hosted |

---

## 2. Prerequisites

### Required Accounts
- [ ] Google account (for GCP)
- [ ] GitHub account (for version control)
- [ ] At least one AI API key (Anthropic, OpenAI, etc.)

### Local Tools (for the implementing agent)
- [ ] SSH client (built into most terminals)
- [ ] Git
- [ ] Text editor for configuration files

### User Action Required
The user must complete these steps manually (cannot be automated by agent):
1. Create GCP account at https://cloud.google.com
2. Enable billing (required even for free tier - won't be charged)
3. Provide the agent with project ID once created

---

## 3. Phase 1: GCP Account & Project Setup

### Step 1.1: User Creates GCP Account
Instruct user:
```
1. Go to https://cloud.google.com
2. Click "Get started for free"
3. Sign in with Google account
4. Accept terms and set up billing
   - You get $300 free credit for 90 days
   - Free tier resources remain free after credit expires
   - You will NOT be charged if you stay within free tier limits
```

### Step 1.2: Create New Project
Instruct user:
```
1. Go to https://console.cloud.google.com
2. Click project dropdown (top left, next to "Google Cloud")
3. Click "New Project"
4. Name: "shamanic-guide-backend" (or preferred name)
5. Note the Project ID (e.g., "shamanic-guide-backend-12345")
6. Click "Create"
```

### Step 1.3: Enable Required APIs
Navigate to APIs & Services > Enable APIs:
- Compute Engine API (required for VM)

```
# Direct link to enable Compute Engine API:
https://console.cloud.google.com/apis/library/compute.googleapis.com
```

---

## 4. Phase 2: Create Free Tier VM

### CRITICAL: Free Tier Requirements
To remain within GCP's Always Free tier:
- **Instance type:** e2-micro only
- **Region:** us-west1, us-central1, or us-east1 only
- **Disk:** 30GB standard persistent disk maximum
- **Network:** 1GB egress to most destinations

### Step 2.1: Create VM Instance

Navigate: Compute Engine > VM Instances > Create Instance

**Configuration:**
```yaml
Name: n8n-server
Region: us-central1 (Iowa)  # Free tier eligible
Zone: us-central1-a

Machine configuration:
  Series: E2
  Machine type: e2-micro (2 vCPU, 1 GB memory)  # MUST be e2-micro for free tier

Boot disk:
  Operating system: Ubuntu
  Version: Ubuntu 22.04 LTS
  Boot disk type: Standard persistent disk
  Size: 30 GB  # Maximum for free tier

Firewall:
  [x] Allow HTTP traffic
  [x] Allow HTTPS traffic
```

### Step 2.2: Reserve Static IP (Optional but Recommended)

Navigate: VPC Network > IP addresses > Reserve External Static Address

```yaml
Name: n8n-static-ip
Network tier: Premium
Version: IPv4
Region: us-central1  # Must match VM region
Attached to: n8n-server
```

Note: Static IPs are free while attached to a running VM, but cost ~$0.01/hour if unattached.

### Step 2.3: Note Connection Details

After VM creation, record:
```
External IP: [EXTERNAL_IP]
Internal IP: [INTERNAL_IP]
Zone: us-central1-a
```

---

## 5. Phase 3: Server Configuration

### Step 3.1: SSH into VM

Option A - Browser SSH (easiest):
```
1. Go to Compute Engine > VM Instances
2. Click "SSH" button next to n8n-server
```

Option B - Terminal SSH:
```bash
gcloud compute ssh n8n-server --zone=us-central1-a
```

Option C - Standard SSH (after adding SSH key):
```bash
ssh -i ~/.ssh/gcp_key username@[EXTERNAL_IP]
```

### Step 3.2: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 3.3: Install Docker

```bash
# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add current user to docker group (avoids needing sudo)
sudo usermod -aG docker $USER

# Apply group change (or log out and back in)
newgrp docker

# Verify installation
docker --version
```

### Step 3.4: Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

---

## 6. Phase 4: Install & Run n8n

### Step 4.1: Create Directory Structure

```bash
mkdir -p ~/n8n-docker
cd ~/n8n-docker
mkdir -p n8n_data
```

### Step 4.2: Create Docker Compose File

Create `~/n8n-docker/docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      # Basic configuration
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      
      # Webhook URL (important for external triggers)
      - WEBHOOK_URL=https://${N8N_HOST}/
      
      # Security
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
      
      # Timezone
      - GENERIC_TIMEZONE=America/Los_Angeles
      - TZ=America/Los_Angeles
      
      # Execution settings (tune for e2-micro limits)
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
      - N8N_METRICS=false
      
    volumes:
      - ./n8n_data:/home/node/.n8n
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Step 4.3: Create Environment File

Create `~/n8n-docker/.env`:

```bash
# n8n Configuration
# IMPORTANT: Replace these values!

# Your domain or IP address
N8N_HOST=your-domain.com

# Authentication (CHANGE THESE!)
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD

# Generate a secure password with:
# openssl rand -base64 32
```

**SECURITY NOTE:** Generate a strong password:
```bash
openssl rand -base64 32
```

### Step 4.4: Start n8n

```bash
cd ~/n8n-docker
docker-compose up -d

# Check logs
docker-compose logs -f

# Verify running
docker ps
```

### Step 4.5: Test Access

If no domain yet, temporarily access via IP:
```
http://[EXTERNAL_IP]:5678
```

You should see the n8n login screen.

---

## 7. Phase 5: Security & Firewall

### Step 5.1: Configure GCP Firewall

Navigate: VPC Network > Firewall > Create Firewall Rule

**Rule 1: Allow n8n (temporary for testing)**
```yaml
Name: allow-n8n-temp
Network: default
Direction: Ingress
Action: Allow
Targets: All instances in network
Source IP ranges: 0.0.0.0/0
Protocols and ports:
  Specified protocols and ports:
    TCP: 5678
```

**Rule 2: Allow HTTPS (for production with SSL)**
```yaml
Name: allow-https
Network: default
Direction: Ingress
Action: Allow
Targets: All instances in network
Source IP ranges: 0.0.0.0/0
Protocols and ports:
  Specified protocols and ports:
    TCP: 443
```

### Step 5.2: Harden SSH

Edit `/etc/ssh/sshd_config`:
```bash
sudo nano /etc/ssh/sshd_config
```

Recommended settings:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### Step 5.3: Install Fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 8. Phase 6: Domain & SSL (Optional but Recommended)

### Why SSL?
- Required for secure webhook calls from frontend
- Browsers block mixed HTTP/HTTPS content
- Professional appearance

### Option A: Use a Domain (Recommended)

#### Step 6A.1: Point Domain to VM

In your domain registrar's DNS settings:
```
Type: A
Name: n8n (or @ for root)
Value: [EXTERNAL_IP]
TTL: 300
```

Wait for DNS propagation (5-30 minutes).

#### Step 6A.2: Install Caddy (Automatic SSL)

Caddy automatically obtains and renews SSL certificates.

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

#### Step 6A.3: Configure Caddy

Create `/etc/caddy/Caddyfile`:
```bash
sudo nano /etc/caddy/Caddyfile
```

Content:
```
n8n.yourdomain.com {
    reverse_proxy localhost:5678
}
```

Restart Caddy:
```bash
sudo systemctl restart caddy
sudo systemctl enable caddy
```

#### Step 6A.4: Update n8n Configuration

Update `~/n8n-docker/.env`:
```bash
N8N_HOST=n8n.yourdomain.com
```

Update `~/n8n-docker/docker-compose.yml` to only listen locally:
```yaml
ports:
  - "127.0.0.1:5678:5678"  # Only accessible via Caddy
```

Restart n8n:
```bash
cd ~/n8n-docker
docker-compose down
docker-compose up -d
```

### Option B: IP-Only Access (Development)

For development without a domain, access directly via IP. Note limitations:
- No SSL (insecure)
- Some webhook integrations may not work
- Not recommended for production

---

## 9. Phase 7: n8n Configuration for Shamanic Guide

### Step 7.1: Initial n8n Setup

1. Access n8n at `https://n8n.yourdomain.com` (or `http://[IP]:5678`)
2. Log in with credentials from `.env`
3. Complete initial setup wizard

### Step 7.2: Add AI Credentials

Navigate: Settings > Credentials > Add Credential

**Anthropic (Claude):**
```
Name: Anthropic Claude
API Key: [YOUR_ANTHROPIC_API_KEY]
```

**OpenAI (Optional):**
```
Name: OpenAI
API Key: [YOUR_OPENAI_API_KEY]
```

### Step 7.3: Create Base Shamanic Guide Workflow

Create new workflow: "Shamanic Guide - Main"

**Workflow Structure:**
```
[Webhook Trigger]
       │
       ▼
[Switch Node: Route by Type]
       │
       ├── journey_request ──► [Claude: Generate Journey]
       │                              │
       │                              ▼
       │                       [Format Response]
       │
       ├── oracle_reading ───► [Random Card Selection]
       │                              │
       │                              ▼
       │                       [Claude: Interpret Card]
       │                              │
       │                              ▼
       │                       [Format Response]
       │
       ├── dream_interpret ──► [Claude: Analyze Dream]
       │                              │
       │                              ▼
       │                       [Format Response]
       │
       └── chat ─────────────► [Claude: Conversational]
                                      │
                                      ▼
                               [Format Response]
                                      │
                                      ▼
                               [Respond to Webhook]
```

### Step 7.4: Webhook Configuration

**Webhook Node Settings:**
```yaml
HTTP Method: POST
Path: shamanic-guide
Response Mode: Response Node
```

The webhook URL will be:
```
https://n8n.yourdomain.com/webhook/shamanic-guide
```

### Step 7.5: Claude/Anthropic Node - System Prompt

Example system prompt for the Shamanic Guide persona:

```
You are a wise and compassionate shamanic guide, drawing from diverse indigenous wisdom traditions with deep respect and cultural sensitivity. Your role is to:

1. GUIDANCE STYLE:
- Speak with gentle authority and warmth
- Use metaphors from nature and the natural world
- Honor the seeker's own inner wisdom
- Offer perspectives rather than prescriptions

2. KNOWLEDGE DOMAINS:
- Journey work and visualization
- Dream interpretation through symbolic lenses
- Plant and animal spirit symbolism
- Cycles of nature and seasonal wisdom
- Rites of passage and life transitions
- Meditation and breathwork guidance

3. ETHICAL BOUNDARIES:
- Never claim to diagnose or treat medical/psychological conditions
- Acknowledge the limits of your knowledge
- Encourage seekers to also consult appropriate professionals when needed
- Respect that you offer one perspective among many

4. RESPONSE FORMAT:
- Begin with a moment of centering or acknowledgment
- Offer your insights with care
- End with an invitation for reflection or a gentle practice

Remember: You are a guide, not a guru. Your role is to help seekers connect with their own inner wisdom.
```

### Step 7.6: Export Workflow as JSON

After building workflows:
1. Click three dots menu on workflow
2. Select "Download"
3. Save JSON to your GitHub repo under `/n8n-workflows/`

---

## 10. Phase 8: Frontend Integration

### Step 10.1: Webhook API Contract

Your frontend will call the n8n webhook. Define the API:

**Request:**
```javascript
POST https://n8n.yourdomain.com/webhook/shamanic-guide
Content-Type: application/json

{
  "type": "journey_request" | "oracle_reading" | "dream_interpret" | "chat",
  "message": "User's input text",
  "context": {
    "sessionId": "unique-session-id",
    "previousMessages": []  // Optional: for chat continuity
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "type": "journey" | "oracle" | "dream" | "chat",
  "content": "The guide's response...",
  "metadata": {
    "card": "The Raven",  // For oracle readings
    "themes": ["transformation", "shadow work"],
    "suggestedPractice": "..."
  }
}
```

### Step 10.2: Frontend Code Example (React)

```javascript
// hooks/useShamanicGuide.js

import { useState } from 'react';

const WEBHOOK_URL = 'https://n8n.yourdomain.com/webhook/shamanic-guide';

export function useShamanicGuide() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = async (type, message, context = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          message,
          context: {
            sessionId: context.sessionId || generateSessionId(),
            ...context
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from guide');
      }
      
      const data = await response.json();
      setLoading(false);
      return data;
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const requestJourney = (intention) => sendMessage('journey_request', intention);
  const requestOracleReading = (question) => sendMessage('oracle_reading', question);
  const interpretDream = (dreamDescription) => sendMessage('dream_interpret', dreamDescription);
  const chat = (message, history) => sendMessage('chat', message, { previousMessages: history });

  return {
    loading,
    error,
    requestJourney,
    requestOracleReading,
    interpretDream,
    chat,
  };
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### Step 10.3: CORS Configuration

If your frontend is on a different domain, configure CORS in n8n.

Update `docker-compose.yml` environment:
```yaml
environment:
  # ... existing config ...
  - N8N_CORS_ENABLED=true
  - N8N_CORS_ORIGIN=https://your-frontend-domain.netlify.app
```

---

## 11. Phase 9: Backup & Version Control

### Step 11.1: Workflow Export Script

Create `~/n8n-docker/backup.sh`:

```bash
#!/bin/bash

# n8n Workflow Backup Script
# Run daily via cron

BACKUP_DIR="/home/$USER/n8n-backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/n8n_backup_$DATE.tar.gz"

mkdir -p $BACKUP_DIR

# Backup n8n data directory
tar -czf $BACKUP_FILE -C /home/$USER/n8n-docker n8n_data

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

Make executable:
```bash
chmod +x ~/n8n-docker/backup.sh
```

### Step 11.2: Setup Cron Job

```bash
crontab -e
```

Add:
```
0 2 * * * /home/$USER/n8n-docker/backup.sh >> /var/log/n8n-backup.log 2>&1
```

### Step 11.3: Git Repository Structure

Recommended repo structure:
```
shamanic-guide/
├── README.md
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── n8n-workflows/
│   ├── shamanic-guide-main.json
│   ├── oracle-reading.json
│   └── journey-generator.json
├── docs/
│   ├── N8N_GCP_SETUP_GUIDE.md  (this file)
│   └── API_REFERENCE.md
└── infrastructure/
    ├── docker-compose.yml
    └── .env.example
```

### Step 11.4: Workflow Version Control

When exporting workflows from n8n:
1. Export as JSON
2. Commit to `n8n-workflows/` directory
3. Include meaningful commit message

```bash
git add n8n-workflows/shamanic-guide-main.json
git commit -m "feat: add dream interpretation branch to main workflow"
git push
```

---

## 12. Troubleshooting

### Issue: n8n Won't Start

Check logs:
```bash
cd ~/n8n-docker
docker-compose logs --tail=100
```

Common fixes:
```bash
# Permission issues
sudo chown -R 1000:1000 ~/n8n-docker/n8n_data

# Port conflict
sudo lsof -i :5678

# Restart fresh
docker-compose down
docker-compose up -d
```

### Issue: Cannot Access n8n from Browser

1. Check VM external IP is correct
2. Verify firewall rules allow port 5678 or 443
3. Check if n8n container is running: `docker ps`
4. Test locally on VM: `curl http://localhost:5678`

### Issue: Webhook Not Receiving Requests

1. Verify webhook URL is correct (check n8n UI)
2. Check CORS settings if cross-origin
3. Ensure workflow is activated (toggle ON)
4. Check n8n execution logs for errors

### Issue: Out of Memory on e2-micro

The e2-micro has only 1GB RAM. If n8n becomes slow:

```bash
# Check memory usage
free -h
docker stats

# Add swap space
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Issue: SSL Certificate Problems

If using Caddy:
```bash
# Check Caddy status
sudo systemctl status caddy

# View Caddy logs
sudo journalctl -u caddy --since "1 hour ago"

# Restart Caddy
sudo systemctl restart caddy
```

---

## 13. Maintenance Procedures

### Daily Automated
- Backups via cron (configured in Phase 9)

### Weekly Manual
- Check execution logs for errors
- Review disk space: `df -h`
- Check memory usage: `free -h`

### Monthly Manual
- Update n8n:
  ```bash
  cd ~/n8n-docker
  docker-compose pull
  docker-compose down
  docker-compose up -d
  ```
- Update system:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```
- Review and rotate API keys if needed

### Updating n8n

```bash
cd ~/n8n-docker

# Backup first!
./backup.sh

# Pull latest image
docker-compose pull

# Restart with new version
docker-compose down
docker-compose up -d

# Verify
docker-compose logs -f
```

---

## Quick Reference Card

### SSH Access
```bash
gcloud compute ssh n8n-server --zone=us-central1-a
```

### Start/Stop n8n
```bash
cd ~/n8n-docker
docker-compose up -d    # Start
docker-compose down     # Stop
docker-compose restart  # Restart
```

### View Logs
```bash
docker-compose logs -f
```

### Backup
```bash
~/n8n-docker/backup.sh
```

### URLs
- n8n UI: `https://n8n.yourdomain.com`
- Webhook base: `https://n8n.yourdomain.com/webhook/`
- Health check: `https://n8n.yourdomain.com/healthz`

---

## Implementation Checklist

- [ ] GCP account created and billing enabled
- [ ] Project created
- [ ] Compute Engine API enabled
- [ ] e2-micro VM created in free tier region
- [ ] Static IP reserved and attached
- [ ] Docker and Docker Compose installed
- [ ] n8n docker-compose.yml configured
- [ ] Environment variables set with secure password
- [ ] n8n container running
- [ ] Firewall rules configured
- [ ] (Optional) Domain pointed to VM IP
- [ ] (Optional) Caddy installed for SSL
- [ ] AI credentials added to n8n
- [ ] Base shamanic guide workflow created
- [ ] Webhook tested from frontend
- [ ] Backup cron job configured
- [ ] Workflows exported to git repo

---

*Guide version: 1.0*  
*Last updated: January 2026*  
*Target: Claude Opus 4.5 implementation agent*
