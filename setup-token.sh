#!/usr/bin/env bash
# 一次性：把 Cloudflare API token 安全存到 ~/.cloudflare_token
# 之後 deploy.sh 會自動 source 這個檔
set -euo pipefail

read -rsp "貼上 Cloudflare API token（不會顯示）後按 Enter: " T
echo
if [ -z "$T" ]; then
  echo "✗ 沒收到 token，中止"
  exit 1
fi
printf "export CLOUDFLARE_API_TOKEN='%s'\n" "$T" > ~/.cloudflare_token
chmod 600 ~/.cloudflare_token
unset T
echo "✓ 已存到 ~/.cloudflare_token (僅自己可讀)"
echo
echo "驗證 token 是否生效..."
# shellcheck disable=SC1090
source ~/.cloudflare_token
wrangler whoami
