#!/bin/bash

# ============================================================================
# MakanMakan Database Backup Script
# ============================================================================
# Description: Complete backup of current database before refactoring
# Usage: ./backup-database.sh [environment]
# Example: ./backup-database.sh staging
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ENVIRONMENT=${1:-staging}

# Database names
case $ENVIRONMENT in
  staging)
    DB_NAME="makanmakan-staging"
    ;;
  production)
    DB_NAME="makanmakan-prod"
    ;;
  local)
    DB_NAME="makanmakan-local"
    ;;
  *)
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "Usage: ./backup-database.sh [staging|production|local]"
    exit 1
    ;;
esac

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"
METADATA_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}_metadata.json"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  MakanMakan Database Backup${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Database:${NC} $DB_NAME"
echo -e "${YELLOW}Backup File:${NC} $BACKUP_FILE"
echo -e "${YELLOW}Timestamp:${NC} $TIMESTAMP"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Step 1: Export database
echo -e "${BLUE}📦 Step 1/5: Exporting database...${NC}"
if [ "$ENVIRONMENT" == "local" ]; then
  # Local SQLite backup
  sqlite3 .wrangler/state/d1/DB.sqlite3 ".dump" > "$BACKUP_FILE"
else
  # Cloudflare D1 backup
  npx wrangler d1 export "$DB_NAME" --output "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Database exported successfully${NC}"
else
  echo -e "${RED}❌ Database export failed${NC}"
  exit 1
fi

# Step 2: Get table list
echo ""
echo -e "${BLUE}📋 Step 2/5: Getting table list...${NC}"
if [ "$ENVIRONMENT" == "local" ]; then
  TABLES=$(sqlite3 .wrangler/state/d1/DB.sqlite3 ".tables")
else
  TABLES=$(npx wrangler d1 execute "$DB_NAME" --command ".tables")
fi
echo -e "${GREEN}✅ Found tables: $TABLES${NC}"

# Step 3: Get row counts
echo ""
echo -e "${BLUE}🔢 Step 3/5: Getting row counts...${NC}"
echo "{"
echo "  \"timestamp\": \"$TIMESTAMP\","
echo "  \"environment\": \"$ENVIRONMENT\","
echo "  \"database\": \"$DB_NAME\","
echo "  \"backup_file\": \"$BACKUP_FILE\","
echo "  \"tables\": {"

FIRST=true
for table in $TABLES; do
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo ","
  fi

  if [ "$ENVIRONMENT" == "local" ]; then
    COUNT=$(sqlite3 .wrangler/state/d1/DB.sqlite3 "SELECT COUNT(*) FROM $table")
  else
    COUNT=$(npx wrangler d1 execute "$DB_NAME" --command "SELECT COUNT(*) FROM $table" | grep -oP '\d+' | head -1)
  fi

  echo -n "    \"$table\": $COUNT"
done

echo ""
echo "  }"
echo "}" > "$METADATA_FILE"

echo -e "${GREEN}✅ Row counts saved to metadata${NC}"

# Step 4: Verify backup file
echo ""
echo -e "${BLUE}🔍 Step 4/5: Verifying backup file...${NC}"
if [ -f "$BACKUP_FILE" ]; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}✅ Backup file exists: $FILE_SIZE${NC}"
else
  echo -e "${RED}❌ Backup file not found${NC}"
  exit 1
fi

# Step 5: Create compressed archive
echo ""
echo -e "${BLUE}🗜️  Step 5/5: Creating compressed archive...${NC}"
ARCHIVE_FILE="${BACKUP_FILE}.tar.gz"
tar -czf "$ARCHIVE_FILE" "$BACKUP_FILE" "$METADATA_FILE"

if [ $? -eq 0 ]; then
  ARCHIVE_SIZE=$(du -h "$ARCHIVE_FILE" | cut -f1)
  echo -e "${GREEN}✅ Archive created: $ARCHIVE_SIZE${NC}"

  # Optional: Remove uncompressed files
  # rm "$BACKUP_FILE" "$METADATA_FILE"
else
  echo -e "${RED}❌ Archive creation failed${NC}"
  exit 1
fi

# Summary
echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Backup Details:${NC}"
echo -e "  📁 Backup File: $BACKUP_FILE"
echo -e "  📁 Archive: $ARCHIVE_FILE"
echo -e "  📁 Metadata: $METADATA_FILE"
echo -e "  📊 Archive Size: $ARCHIVE_SIZE"
echo ""
echo -e "${YELLOW}Table Statistics:${NC}"
cat "$METADATA_FILE" | grep -E '".*": [0-9]+' | while read line; do
  echo -e "  $line"
done
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Verify backup: tar -tzf $ARCHIVE_FILE"
echo -e "  2. Test restore: ./restore-backup.sh $ARCHIVE_FILE"
echo -e "  3. Store safely: Copy to backup storage"
echo ""
echo -e "${GREEN}🎉 Ready to proceed with refactoring!${NC}"
echo ""
