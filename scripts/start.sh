#!/usr/bin/env sh
# Точка входа для Render: поднимает Litestream (репликация SQLite в облако) и бота.
# Без переменных LITESTREAM_* работает как обычно: обычный `node src/index.js`.
set -eu

LITESTREAM_VERSION="v0.5.18"
BIN="./bin/litestream"

# Litestream ждёт абсолютный путь к базе, а DB_PATH в render.yaml относительный.
DB_PATH="${DB_PATH:-./data/lingo.db}"
case "$DB_PATH" in
  /*) ;;
  *) DB_PATH="$(pwd)/${DB_PATH#./}" ;;
esac
export DB_PATH
export LITESTREAM_PREFIX="${LITESTREAM_PREFIX:-lingo}"

replication_enabled() {
  [ -n "${LITESTREAM_ENDPOINT:-}" ] && [ -n "${LITESTREAM_BUCKET:-}" ]
}

install_litestream() {
  [ -x "$BIN" ] && return 0
  case "$(uname -m)" in
    x86_64 | amd64) target="linux-x86_64" ;;
    aarch64 | arm64) target="linux-arm64" ;;
    *) echo "[litestream] неизвестная архитектура $(uname -m), репликация выключена"; return 1 ;;
  esac
  url="https://github.com/benbjohnson/litestream/releases/download/${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION#v}-${target}.tar.gz"
  mkdir -p bin
  echo "[litestream] скачиваю ${LITESTREAM_VERSION} (${target})"
  if curl -fsSL "$url" | tar -xz -C bin litestream; then
    chmod +x "$BIN"
    return 0
  fi
  echo "[litestream] не удалось скачать бинарник, репликация выключена"
  return 1
}

if replication_enabled && install_litestream; then
  echo "[litestream] репликация в ${LITESTREAM_BUCKET}/${LITESTREAM_PREFIX:-lingo}, база ${DB_PATH}"
  exec "$BIN" replicate -config ./litestream.yml -exec "node src/index.js" -restore-if-db-not-exists
fi

echo "[litestream] репликация не настроена — база живёт только внутри контейнера"
exec node src/index.js
