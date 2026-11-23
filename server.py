#!/usr/bin/env python3
"""Локальный сервер для Roooms: раздаёт игру и хранит прогресс в save.json."""

import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SAVE_FILE = ROOT / "save.json"
DEFAULT_SAVE = {"level": 1, "xp": 0}


def normalize_save(data):
    try:
        level = int(data.get("level", 1))
    except (AttributeError, TypeError, ValueError):
        level = 1
    try:
        xp = int(data.get("xp", 0))
    except (TypeError, ValueError):
        xp = 0
    return {"level": max(1, level), "xp": max(0, xp)}


def read_save():
    try:
        with SAVE_FILE.open("r", encoding="utf-8") as f:
            return normalize_save(json.load(f))
    except (OSError, ValueError):
        return dict(DEFAULT_SAVE)


def write_save(data):
    payload = normalize_save(data)
    tmp = SAVE_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, SAVE_FILE)
    return payload


class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/save":
            self._json(200, read_save())
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/save":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8")) if raw else {}
            payload = write_save(data)
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})
            return
        self._json(200, {"ok": True, "save": payload})


if __name__ == "__main__":
    write_save(read_save())
    server = ThreadingHTTPServer(("0.0.0.0", 8123), GameHandler)
    print("Roooms: http://localhost:8123/  (прогресс в save.json рядом с игрой)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
