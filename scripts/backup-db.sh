#!/usr/bin/env sh
# Nightly PostgreSQL backup for the production stack.
#
#   ./scripts/backup-db.sh                    # writes backups/techfinder-YYYYmmdd-HHMMSS.sql.gz
#   KEEP_DAYS=30 ./scripts/backup-db.sh
#
# Cron example (02:30 every night):
#   30 2 * * * cd /srv/techfinder && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Copy the backups directory OFF the server (S3, Backblaze B2, another host);
# a backup on the same disk does not survive losing the server.
#
# Restore into an empty database:
#   gunzip -c backups/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U techfinder -d techfinder
set -eu

COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"
DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$DIR/techfinder-$STAMP.sql.gz"

mkdir -p "$DIR"
umask 077   # backups contain personal data: owner-only permissions

$COMPOSE exec -T db pg_dump -U techfinder -d techfinder --no-owner --clean --if-exists | gzip -9 > "$FILE.partial"
mv "$FILE.partial" "$FILE"
gzip -t "$FILE"
echo "$(date -Iseconds) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"

find "$DIR" -name 'techfinder-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
