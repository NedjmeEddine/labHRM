#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "  EL-AMEL LAB — Cloudflare Tunnel Remote Access Setup"
echo "=========================================================="
echo ""

if ! command -v cloudflared &> /dev/null; then
    echo ">> 'cloudflared' was not found on your system."
    echo ">> Installation options:"
    echo "   - Arch Linux: sudo pacman -S cloudflared"
    echo "   - Debian/Ubuntu: sudo apt install cloudflared"
    echo "   - Windows (winget): winget install --id Cloudflare.cloudflared"
    echo "   - Direct download: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/"
    echo ""
    exit 1
fi

echo ">> Select tunnel mode:"
echo "   1) Quick Tunnel (Free, instant random https://*.trycloudflare.com URL)"
echo "   2) Production Named Tunnel (Permanent domain e.g. rh.elamel-lab.dz with Zero Trust)"
echo ""
read -r -p "Enter choice [1 or 2]: " choice

case "$choice" in
    1)
        echo ">> Starting Cloudflare Quick Tunnel to local backend (http://127.0.0.1:8000)..."
        echo ">> Keep this window open. Open the generated HTTPS URL on your phone to log in."
        cloudflared tunnel --url http://127.0.0.1:8000
        ;;
    2)
        read -r -p "Enter your Cloudflare tunnel token (from Cloudflare Zero Trust dashboard): " token
        if [ -z "$token" ]; then
            echo "Error: Token cannot be empty."
            exit 1
        fi
        echo ">> Running tunnel service with token..."
        cloudflared tunnel run --token "$token"
        ;;
    *)
        echo "Invalid choice."
        exit 1
        ;;
esac
