#!/usr/bin/env bash
# 字字千金 v2 — 一鍵部署
# 流程:
#   1. 確認 CLOUDFLARE_API_TOKEN
#   2. 建立 / 找到 D1 資料庫,把 database_id 寫進 wrangler.toml
#   3. 設定 ADMIN_PASSWORD 與 ADMIN_TOKEN_SECRET
#   4. 灌入 schema + 892 題 seed
#   5. 部署到 Cloudflare Pages
#
# 用法:  ./setup-v2.sh
# 可重複執行 (已建立的資源會跳過或更新)。

set -euo pipefail

cd "$(dirname "$0")"

DB_NAME="zzqj-db"
PROJECT="zi-zi-qian-jin"
WRANGLER_TOML="wrangler.toml"

# === 顏色 ===
C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_BLUE='\033[0;34m'; C_NC='\033[0m'
info()  { printf "${C_BLUE}→${C_NC} %s\n" "$*"; }
ok()    { printf "${C_GREEN}✓${C_NC} %s\n" "$*"; }
warn()  { printf "${C_YELLOW}⚠${C_NC} %s\n" "$*"; }
fail()  { printf "${C_RED}✗${C_NC} %s\n" "$*" >&2; exit 1; }

# === Step 0: 確認 wrangler 與 CLOUDFLARE_API_TOKEN ===
info "檢查 wrangler 與 API token"
command -v wrangler >/dev/null || fail "找不到 wrangler — 請先 'npm install -g wrangler'"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "$HOME/.cloudflare_token" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.cloudflare_token"
  fi
fi
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || fail "未設定 CLOUDFLARE_API_TOKEN (export 或寫入 ~/.cloudflare_token)"
ok "CLOUDFLARE_API_TOKEN 已就緒"

# === Step 1: 確認/建立 D1 ===
info "Step 1/5  確認 D1 資料庫: $DB_NAME"

# 從現有 wrangler.toml 抓 database_id
CURRENT_ID=$(grep -E '^database_id\s*=' "$WRANGLER_TOML" | head -1 | sed -E 's/.*"([^"]+)".*/\1/' || true)

if [ -n "$CURRENT_ID" ] && [ "$CURRENT_ID" != "REPLACE_WITH_YOUR_D1_DATABASE_ID" ]; then
  ok "wrangler.toml 已有 database_id: $CURRENT_ID"
else
  # 先查是否存在
  info "查詢遠端是否已有 $DB_NAME"
  LIST_JSON=$(wrangler d1 list --json 2>/dev/null || echo '[]')
  EXISTING_ID=$(echo "$LIST_JSON" | grep -B1 "\"name\": \"$DB_NAME\"" | grep '"uuid"' | head -1 | sed -E 's/.*"([0-9a-f-]+)".*/\1/' || true)

  if [ -n "$EXISTING_ID" ]; then
    ok "找到既有資料庫,id = $EXISTING_ID"
  else
    info "建立新 D1: $DB_NAME"
    CREATE_OUT=$(wrangler d1 create "$DB_NAME" 2>&1)
    echo "$CREATE_OUT"
    EXISTING_ID=$(echo "$CREATE_OUT" | grep -E '(database_id|"uuid")' | head -1 | sed -E 's/.*"([0-9a-f-]+)".*/\1/')
    [ -n "$EXISTING_ID" ] || fail "未能從 wrangler d1 create 解析出 database_id"
    ok "已建立,id = $EXISTING_ID"
  fi

  # 寫回 wrangler.toml
  info "更新 wrangler.toml 內的 database_id"
  if grep -q "REPLACE_WITH_YOUR_D1_DATABASE_ID" "$WRANGLER_TOML"; then
    sed -i.bak "s/REPLACE_WITH_YOUR_D1_DATABASE_ID/$EXISTING_ID/" "$WRANGLER_TOML"
  else
    sed -i.bak -E "s/^(database_id\s*=\s*)\"[^\"]*\"/\1\"$EXISTING_ID\"/" "$WRANGLER_TOML"
  fi
  rm -f "${WRANGLER_TOML}.bak"
  ok "wrangler.toml 已更新"
fi

# === Step 2: 設定 secrets ===
info "Step 2/5  設定後台 secrets"
echo
echo "後台 (/admin) 需要密碼登入。"
read -r -s -p "請設定 ADMIN_PASSWORD: " ADMIN_PW
echo
read -r -s -p "請再次輸入確認: " ADMIN_PW2
echo
[ "$ADMIN_PW" = "$ADMIN_PW2" ] || fail "兩次輸入不一致"
[ -n "$ADMIN_PW" ] || fail "密碼不能為空"
[ ${#ADMIN_PW} -ge 6 ] || fail "密碼至少 6 字元"

info "上傳 ADMIN_PASSWORD"
echo "$ADMIN_PW" | wrangler pages secret put ADMIN_PASSWORD --project-name "$PROJECT" >/dev/null
ok "ADMIN_PASSWORD 已設定"

info "產生並上傳 ADMIN_TOKEN_SECRET (隨機 64 hex)"
TOKEN_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
echo "$TOKEN_SECRET" | wrangler pages secret put ADMIN_TOKEN_SECRET --project-name "$PROJECT" >/dev/null
ok "ADMIN_TOKEN_SECRET 已設定"

unset ADMIN_PW ADMIN_PW2 TOKEN_SECRET

# === Step 3: 灌 schema + seed ===
info "Step 3/5  灌入 schema 與 892 題 seed (遠端 D1)"
./scripts/seed-d1.sh remote
ok "題庫灌入完成"

# === Step 4: 部署 ===
info "Step 4/5  部署到 Cloudflare Pages"
./deploy.sh
ok "部署完成"

# === Step 5: 確認 ===
info "Step 5/5  最終確認"
echo
ok "🎉 字字千金 v2 上線了!"
echo
echo "  遊戲:   https://${PROJECT}.pages.dev"
echo "  後台:   https://${PROJECT}.pages.dev/admin/"
echo
echo "後台密碼即剛才設定的 ADMIN_PASSWORD。"
echo "若要重設密碼:wrangler pages secret put ADMIN_PASSWORD --project-name $PROJECT"
