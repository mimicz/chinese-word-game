#!/usr/bin/env bash
# 重新灌入 zizhu 題庫 (FK-safe:軟刪舊的、insert 新的)
# 用法:  ./scripts/reseed-zizhu.sh local|remote

set -euo pipefail
cd "$(dirname "$0")/.."

ENV="${1:-}"
if [[ "$ENV" != "local" && "$ENV" != "remote" ]]; then
  echo "用法: $0 local|remote"; exit 1
fi
FLAG="--${ENV}"

DB="zzqj-db"

echo "→ 1) 軟刪舊 zizhu (UPDATE active=0)"
wrangler d1 execute "$DB" "$FLAG" --command \
  "UPDATE questions SET active=0 WHERE type='zizhu' AND active=1;"

echo "→ 2) 灌入新題 (elementary)"
wrangler d1 execute "$DB" "$FLAG" --file schema/seeds/zizhu-elementary.sql

echo "→ 3) 灌入新題 (middle)"
wrangler d1 execute "$DB" "$FLAG" --file schema/seeds/zizhu-middle.sql

echo "→ 4) 統計"
wrangler d1 execute "$DB" "$FLAG" --command \
  "SELECT type, difficulty, COUNT(*) AS n FROM questions WHERE active=1 GROUP BY type, difficulty ORDER BY type, difficulty;"

echo "✓ 完成"
