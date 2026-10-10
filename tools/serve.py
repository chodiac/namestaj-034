# -*- coding: utf-8 -*-
"""Lokalni server za razvoj (bez keširanja).

    python tools/serve.py [port]

Dev-only: POST /__save?path=assets/img/x.jpg (telo = binarni sadržaj) snima fajl u projekat;
koristi se samo za snimanje ilustrativnih kadrova iz 3D scene. Ne koristiti u produkciji.
"""
import os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5200


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/__save':
            self.send_error(404); return
        rel = parse_qs(u.query).get('path', [''])[0]
        dest = os.path.normpath(os.path.join(ROOT, rel))
        if not dest.startswith(os.path.join(ROOT, 'assets')):
            self.send_error(403); return
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
