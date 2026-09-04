#!/bin/bash
###############################################################################
# Swimly Database Backup Script
# 
# Purpose: Create off-platform PostgreSQL backups and upload to AWS S3
# Usage: ./backup-database.sh [daily|monthly]
# Cron: 0 2 * * * for daily, 0 3 1 * * for monthly
# 
# Requirements:
#   - DATABASE_URL environment variable
#   - AWS CLI configured with credentials
#   - PostgreSQL client (pg_dump)
#   - S3 bucket: swimly-database-backups (eu-west-2)
#
# Author: Mike Tempest (CTO, Swimly)
# Last Updated: 2026-03-03
###############################################################################

set -euo pipefail

# Configuration
BACKUP_TYPE="${1:-daily}"  # daily or monthly
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DATE_ONLY=$(date +%Y-%m-%d)
BACKUP_DIR="/tmp/swimly-backups"
S3_BUCKET="${S3_BUCKET:-swimly-database-backups}"
S3_REGION="${S3_REGION:-eu-west-2}"
LOG_FILE="${LOG_FILE:-/var/log/swimly-backup.log}"

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

# Validation
if [ -z "${DATABASE_URL:-}" ]; then
    error "DATABASE_URL environment variable not set"
    exit 1
fi

if ! command -v pg_dump &> /dev/null; then
    error "pg_dump not found. Install PostgreSQL client."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    error "aws CLI not found. Install AWS CLI."
    exit 1
fi

# Validate backup type
if [ "$BACKUP_TYPE" != "daily" ] && [ "$BACKUP_TYPE" != "monthly" ]; then
    error "Invalid backup type: $BACKUP_TYPE. Must be 'daily' or 'monthly'."
    exit 1
fi

log "========================================="
log "Starting $BACKUP_TYPE backup"
log "========================================="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
if [ "$BACKUP_TYPE" = "monthly" ]; then
    BACKUP_FILENAME="swimly-backup-monthly-$TIMESTAMP.sql"
    S3_PREFIX="monthly"
else
    BACKUP_FILENAME="swimly-backup-daily-$TIMESTAMP.sql"
    S3_PREFIX="daily"
fi

BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"
COMPRESSED_PATH="$BACKUP_PATH.gz"

log "Backup file: $BACKUP_FILENAME"

# Perform database dump
log "Starting pg_dump..."
START_TIME=$(date +%s)

if pg_dump "$DATABASE_URL" \
    --format=plain \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    > "$BACKUP_PATH" 2>> "$LOG_FILE"; then
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    
    success "Database dump completed in ${DURATION}s (size: $BACKUP_SIZE)"
else
    error "pg_dump failed"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Compress backup
log "Compressing backup..."
if gzip "$BACKUP_PATH"; then
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
    success "Compression completed (size: $COMPRESSED_SIZE)"
else
    error "Compression failed"
    rm -f "$BACKUP_PATH" "$COMPRESSED_PATH"
    exit 1
fi

# Upload to S3
log "Uploading to S3: s3://$S3_BUCKET/$S3_PREFIX/$BACKUP_FILENAME.gz"
if aws s3 cp "$COMPRESSED_PATH" \
    "s3://$S3_BUCKET/$S3_PREFIX/$BACKUP_FILENAME.gz" \
    --region "$S3_REGION" \
    --storage-class STANDARD \
    --metadata "backup-type=$BACKUP_TYPE,backup-date=$DATE_ONLY,database=swimly" \
    2>> "$LOG_FILE"; then
    
    success "Upload to S3 completed"
else
    error "S3 upload failed"
    rm -f "$COMPRESSED_PATH"
    exit 1
fi

# Verify upload
log "Verifying S3 upload..."
if aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/$BACKUP_FILENAME.gz" \
    --region "$S3_REGION" &> /dev/null; then
    success "S3 upload verified"
else
    error "S3 upload verification failed"
    exit 1
fi

# Clean up local backup
rm -f "$COMPRESSED_PATH"
log "Cleaned up local backup file"

# Database statistics
log "Gathering database statistics..."
DB_STATS=$(psql "$DATABASE_URL" -t -c "
    SELECT 
        'Tables: ' || COUNT(*) || ', ' ||
        'Total Size: ' || pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint)
    FROM pg_tables 
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
" 2>> "$LOG_FILE" || echo "Failed to retrieve stats")

log "Database stats: $DB_STATS"

# Summary
log "========================================="
success "$BACKUP_TYPE backup completed successfully"
log "Backup: s3://$S3_BUCKET/$S3_PREFIX/$BACKUP_FILENAME.gz"
log "Size: $COMPRESSED_SIZE (compressed)"
log "========================================="

# Optional: Send notification (uncomment when notification system is ready)
# send_notification "Swimly Backup Success" "Daily backup completed: $BACKUP_FILENAME.gz ($COMPRESSED_SIZE)"

# Clean up old local backups (keep only today's)
find "$BACKUP_DIR" -name "swimly-backup-*.sql*" -mtime +0 -delete 2>/dev/null || true

exit 0
