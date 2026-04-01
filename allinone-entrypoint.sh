#!/bin/sh
# All-in-one entrypoint: decode Vespa certs from B64 env vars, then start supervisord

set -e

# Decode Vespa Cloud certificates if B64 env vars are set
# Use /tmp since Railway has a read-only filesystem at /app
if [ -n "$VESPA_CLOUD_CERT_B64" ] && [ -n "$VESPA_CLOUD_KEY_B64" ]; then
    CERT_FILE="/tmp/vespa-cert.pem"
    KEY_FILE="/tmp/vespa-key.pem"
    echo "$VESPA_CLOUD_CERT_B64" | base64 -d > "$CERT_FILE"
    echo "$VESPA_CLOUD_KEY_B64" | base64 -d > "$KEY_FILE"
    chmod 600 "$CERT_FILE" "$KEY_FILE"
    # Override the env vars so the app reads from the correct paths
    export VESPA_CLOUD_CERT_PATH="$CERT_FILE"
    export VESPA_CLOUD_KEY_PATH="$KEY_FILE"
    echo "Vespa Cloud certificates decoded to /tmp/"
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
