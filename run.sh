  # ローカルIPアドレスを取得（Wi-Fi接続を想定）
  LOCAL_IP=$(ipconfig getifaddr en0)

  source .env

  PORT=${PORT:-8000}
  ROUTE=${ROUTE:-""}

  # QRコードのURL,環境変数から指定のルーティングを取得する
  URL="http://$LOCAL_IP:$PORT$ROUTE"
  
  # 第二引数がある場合はURLに追加
  if [ -n "$2" ]; then
    URL="$URL$2"
  fi

  # QRコードを生成（qrencodeを使用）
  if ! command -v qrencode &> /dev/null
  then
    echo "qrencode が見つかりません。brew install qrencode でインストールしてください。"
    exit 1
  fi

  echo "アクセスURL: $URL"
  qrencode -o tmp/qr.png -s 100 "$URL"

  # 画像を開く（Macの場合）
  windsurf tmp/qr.png
  python3 -m http.server $PORT
