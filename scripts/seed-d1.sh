#!/usr/bin/env bash
# 把 schema/0001_init.sql 與 schema/seeds/*.sql 灌入 D1
# 用法:
#   ./scripts/seed-d1.sh local    # 灌到本機 dev D1
#   ./scripts/seed-d1.sh remote   # 灌到 production D1

set -euo pipefail

cd "$(dirname "$0")/.."

ENV="${1:-local}"
if [[ "$ENV" != "local" && "$ENV" != "remote" ]]; then
  echo "用法: $0 local|remote"
  exit 1
fi

FLAG="--${ENV}"
echo "→ 建立 schema (${ENV})"
wrangler d1 execute zzqj-db "${FLAG}" --file schema/0001_init.sql

echo "→ 灌入 seed (${ENV})"
shopt -s nullglob
for f in schema/seeds/*.sql; do
  echo "   • $f"
  wrangler d1 execute zzqj-db "${FLAG}" --file "$f"
done

echo "→ 統計"
wrangler d1 execute zzqj-db "${FLAG}" --command \
  "SELECT type, difficulty, COUNT(*) AS n FROM questions WHERE active=1 GROUP BY type, difficulty ORDER BY type, difficulty;"

echo "✓ 完成"
