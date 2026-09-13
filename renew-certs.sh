#!/bin/bash
set -e
LOG_FILE="/var/log/certbot-renew.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting SSL certificate check/renewal..." >> "$LOG_FILE" 2>&1

docker run --rm \
  -v /var/www/tesla-parts/certbot/conf:/etc/letsencrypt \
  -v /var/www/tesla-parts/certbot/www:/var/www/certbot \
  certbot/certbot renew >> "$LOG_FILE" 2>&1

docker exec tesla-parts-gateway-1 nginx -s reload >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] SSL certificate check/renewal completed successfully." >> "$LOG_FILE" 2>&1
