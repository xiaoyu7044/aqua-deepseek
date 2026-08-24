#!/usr/bin/env python3
"""
极简后端: 提供演示页面 + /api/ds-price-config 价格配置接口
用法: python3 server.py [--port 8080] [--config /path/ds_price_config.json]
无需 Flask, 仅用标准库.
"""
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8080
CONFIG = os.environ.get("DS_CONFIG", os.path.join(os.path.dirname(__file__), "..", "ds_price_config.json"))
BUILTIN = {
    "models": {
        "flash": {
            "name": "DeepSeek-V4-Flash", "ver": "0731",
            "cacheHit": {"off": 0.05, "peak": 0.10},
            "cacheMiss": {"off": 1.50, "peak": 3.00},
            "output": {"off": 4.50, "peak": 9.00},
        },
        "pro": {
            "name": "DeepSeek-V4-Pro", "ver": "0813",
            "cacheHit": {"off": 0.15, "peak": 0.30},
            "cacheMiss": {"off": 4.50, "peak": 9.00},
            "output": {"off": 13.50, "peak": 27.00},
        },
    },
    "segments": [[9, 12], [14, 18]],
    "weekendOff": True,
}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/ds-price-config":
            cfg = BUILTIN
            if os.path.exists(CONFIG):
                try:
                    cfg = json.load(open(CONFIG, encoding="utf-8"))
                except Exception:
                    pass
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(cfg, ensure_ascii=False).encode())
            return
        super().do_GET()

    def log_message(self, format, *args):
        if "/api/" in str(args[0]):
            super().log_message(format, *args)


def main():
    port = PORT
    for i, a in enumerate(sys.argv):
        if a == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i + 1])
        if a == "--config" and i + 1 < len(sys.argv):
            global CONFIG
            CONFIG = sys.argv[i + 1]
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"🐟 Aqua DeepSeek demo server: http://localhost:{port}")
    print(f"   配置文件: {CONFIG}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
