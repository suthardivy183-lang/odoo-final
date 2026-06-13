"""Static server for the built SPA (dist/) with:
  - history-API fallback (client-side routing)
  - /api/* reverse-proxy to the FastAPI backend (default localhost:8000)

This makes the production build fully functional without the Vite dev server.
Usage: python serve_dist.py [port] [backend_url]
"""
import os
import sys
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
BACKEND = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # quiet

    # ---- API proxy ----
    def _proxy(self):
        url = BACKEND + self.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(url, data=body, method=self.command)
        for k, v in self.headers.items():
            if k.lower() not in HOP_BY_HOP and k.lower() != "host":
                req.add_header(k, v)

        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    if k.lower() not in HOP_BY_HOP and k.lower() != "content-length":
                        self.send_header(k, v)
                data = resp.read()
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() not in HOP_BY_HOP and k.lower() != "content-length":
                    self.send_header(k, v)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.URLError as e:
            self.send_error(502, f"Backend unreachable: {e.reason}")

    # ---- static files + SPA fallback ----
    def _serve_static(self):
        path = self.path.split("?", 1)[0]
        fs_path = os.path.join(DIST, path.lstrip("/"))
        if not os.path.isfile(fs_path):
            fs_path = os.path.join(DIST, "index.html")  # SPA fallback

        try:
            with open(fs_path, "rb") as f:
                data = f.read()
        except FileNotFoundError:
            self.send_error(404)
            return

        ctype = "text/html"
        if fs_path.endswith(".js"): ctype = "application/javascript"
        elif fs_path.endswith(".css"): ctype = "text/css"
        elif fs_path.endswith(".svg"): ctype = "image/svg+xml"
        elif fs_path.endswith(".json"): ctype = "application/json"
        elif fs_path.endswith(".png"): ctype = "image/png"

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _route(self):
        if self.path.startswith("/api"):
            self._proxy()
        else:
            self._serve_static()

    do_GET = _route
    do_POST = _route
    do_PUT = _route
    do_DELETE = _route
    do_PATCH = _route


if __name__ == "__main__":
    print(f"Serving {DIST} on http://localhost:{PORT} (proxying /api -> {BACKEND})")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
