"""Minimal static server for the built SPA (dist/) with history-API fallback.
Usage: python serve_dist.py [port]
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        # If the requested file doesn't exist and it's not an asset, serve index.html
        if not os.path.exists(path) or os.path.isdir(path):
            if not self.path.startswith("/assets"):
                self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    print(f"Serving {DIST} on http://localhost:{PORT}")
    HTTPServer(("127.0.0.1", PORT), SPAHandler).serve_forever()
