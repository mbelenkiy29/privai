#!/bin/sh
# All-in-one entrypoint: decode Vespa certs from B64 env vars, then start supervisord

set -e

# Decode Vespa Cloud certificates if B64 env vars are set
if [ -n "$VESPA_CLOUD_CERT_B64" ] && [ -n "$VESPA_CLOUD_KEY_B64" ]; then
    CERT_DIR=$(dirname "${VESPA_CLOUD_CERT_PATH:-/app/certs/vespa-cert.pem}")
    mkdir -p "$CERT_DIR"
    echo "$VESPA_CLOUD_CERT_B64" | base64 -d > "${VESPA_CLOUD_CERT_PATH:-/app/certs/vespa-cert.pem}"
    echo "$VESPA_CLOUD_KEY_B64" | base64 -d > "${VESPA_CLOUD_KEY_PATH:-/app/certs/vespa-key.pem}"
    chmod 600 "${VESPA_CLOUD_CERT_PATH:-/app/certs/vespa-cert.pem}" "${VESPA_CLOUD_KEY_PATH:-/app/certs/vespa-key.pem}"
    echo "Vespa Cloud certificates decoded to $CERT_DIR"
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
