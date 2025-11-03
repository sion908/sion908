# cors_server.py を作成
from http.server import HTTPServer, SimpleHTTPRequestHandler
import argparse
import ssl
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CERT = BASE_DIR / 'tmp/certs/localhost.crt'
DEFAULT_KEY = BASE_DIR / 'tmp/certs/localhost.key'


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='CORS対応の静的ファイルサーバー (HTTP/HTTPS)'
    )
    parser.add_argument(
        'port',
        nargs='?',
        type=int,
        default=8000,
        help='待ち受けポート (未指定時は 8000)'
    )
    parser.add_argument(
        '--cert',
        default=str(DEFAULT_CERT),
        help=f'HTTPS 用の証明書 (PEM) ファイルパス (既定: {DEFAULT_CERT})'
    )
    parser.add_argument(
        '--key',
        default=str(DEFAULT_KEY),
        help=f'HTTPS 用の秘密鍵 (PEM) ファイルパス (既定: {DEFAULT_KEY})'
    )
    parser.add_argument(
        '--force-http',
        action='store_true',
        help='証明書が存在してもHTTPで起動する'
    )
    return parser


def setup_https(httpd: HTTPServer, cert_path: Path, key_path: Path) -> None:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)


if __name__ == '__main__':
    parser = build_arg_parser()
    args = parser.parse_args()

    port = args.port
    cert_path = Path(args.cert).expanduser()
    key_path = Path(args.key).expanduser()

    httpd = HTTPServer(('0.0.0.0', port), CORSRequestHandler)

    scheme = 'http'
    if not args.force_http and cert_path.exists() and key_path.exists():
        try:
            setup_https(httpd, cert_path, key_path)
            scheme = 'https'
        except (ssl.SSLError, FileNotFoundError, OSError) as exc:
            print(f'HTTPS の初期化に失敗しました: {exc}', file=sys.stderr)
            sys.exit(1)
    elif not args.force_http:
        print(
            '証明書または鍵が見つからないためHTTPで起動します。'
            f' cert={cert_path} key={key_path}',
            file=sys.stderr,
        )

    print(f"{scheme.upper()} server running on port {port}")
    httpd.serve_forever()
