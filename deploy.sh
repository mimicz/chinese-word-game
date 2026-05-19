#!/usr/bin/env bash
# 字字千金 一鍵重新部署到 Cloudflare Pages
# 使用前：export CLOUDFLARE_API_TOKEN='你的_token'
#   或把 token 寫進 ~/.cloudflare_token 然後 source

set -euo pipefail

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "$HOME/.cloudflare_token" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.cloudflare_token"
  else
    echo "✗ 未設定 CLOUDFLARE_API_TOKEN"
    echo "  方法 1: export CLOUDFLARE_API_TOKEN='xxx'"
    echo "  方法 2: 把 export 寫進 ~/.cloudflare_token"
    exit 1
  fi
fi

cd "$(dirname "$0")"
echo "→ 部署 $(pwd)/public 到 zi-zi-qian-jin.pages.dev"
wrangler pages deploy public --project-name=zi-zi-qian-jin --commit-dirty=true --branch=main
echo "✓ 完成。網址: https://zi-zi-qian-jin.pages.dev"
