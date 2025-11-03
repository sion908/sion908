  #!/usr/bin/env bash
set -e

if [ "${1:-}" = "cert" ]; then
  CERT_DIR=${2:-tmp/certs}
  KEY_FILE="${CERT_DIR}/localhost.key"
  CERT_FILE="${CERT_DIR}/localhost.crt"
  PEM_FILE="${CERT_DIR}/localhost.pem"

  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl が見つかりません。homebrew 等でインストールしてください。" >&2
    exit 1
  fi

  mkdir -p "${CERT_DIR}"

  SUBJECT="/C=JP/ST=Tokyo/L=Tokyo/O=LocalDev/OU=Dev/CN=localhost"

  openssl req \
    -x509 \
    -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "${SUBJECT}"

  cat "${KEY_FILE}" "${CERT_FILE}" > "${PEM_FILE}"

  echo "秘密鍵: ${KEY_FILE}"
  echo "証明書: ${CERT_FILE}"
  echo "鍵と証明書を結合した PEM: ${PEM_FILE}"
  echo "生成完了。cors_server.py 起動時に --cert \"${CERT_FILE}\" --key \"${KEY_FILE}\" を指定してください。"
  exit 0
fi

# ローカルIPアドレスを取得（Wi-Fi接続を想定）
LOCAL_IP=$(ipconfig getifaddr en0)

source .env

PORT=${PORT:-8000}
ROUTE=${ROUTE:-""}

# QRコードのURL,環境変数から指定のルーティングを取得する
URL="https://$LOCAL_IP:$PORT$ROUTE"

# 第二引数がある場合はURLに追加
if [ -n "${2:-}" ]; then
  URL="$URL$2"
fi

# QRコードを生成（qrencodeを使用）
if ! command -v qrencode >/dev/null 2>&1
then
  echo "qrencode が見つかりません。brew install qrencode でインストールしてください。"
  exit 1
fi

mkdir -p tmp

echo "アクセスURL: $URL"
qrencode -o tmp/qr.png -s 100 "$URL"

# 画像を開く（Macの場合）
windsurf tmp/qr.png

cd ../
python3 setup_server/cors_server.py $PORT --cert "setup_server/tmp/certs/localhost.crt" --key "setup_server/tmp/certs/localhost.key"
