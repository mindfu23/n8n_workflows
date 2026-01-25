#!/bin/bash

# n8n Workflow Backup Script
# Run daily via cron: 0 2 * * * /home/YOUR_USERNAME/n8n-docker/backup.sh
#
# Usage: ./backup.sh [backup_dir]

set -e

# Configuration
BACKUP_DIR="${1:-$HOME/n8n-backups}"
N8N_DATA_DIR="$HOME/n8n-docker/n8n_data"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/n8n_backup_$DATE.tar.gz"
RETENTION_DAYS=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if n8n data directory exists
if [ ! -d "$N8N_DATA_DIR" ]; then
    log_error "n8n data directory not found: $N8N_DATA_DIR"
    exit 1
fi

# Create backup
log_info "Creating backup: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" -C "$(dirname "$N8N_DATA_DIR")" "$(basename "$N8N_DATA_DIR")"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)"
else
    log_error "Backup failed - file not created"
    exit 1
fi

# Clean up old backups
log_info "Removing backups older than $RETENTION_DAYS days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "n8n_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
    log_info "Deleted $DELETED_COUNT old backup(s)"
fi

# List current backups
log_info "Current backups:"
ls -lh "$BACKUP_DIR"/n8n_backup_*.tar.gz 2>/dev/null || log_warn "No backups found"

echo ""
log_info "Backup complete!"
