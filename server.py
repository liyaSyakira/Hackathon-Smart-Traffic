"""
GerakBijak demo server (free, no extra installs).

Runs the website in notebook/ AND saves sign-ups into notebook/data/dummy_residents.csv.
Start it from the main project folder:   python3 server.py
Then open port 8000 and go to /login.html

API used by js/gb-auth.js:
  GET  /api/ping        -> {"ok": true}
  GET  /api/residents   -> all residents (no passwords, no emails)
  POST /api/signup      -> adds a new row to the CSV
  POST /api/signin      -> checks resident ID or email + password
  POST /api/profile     -> saves profile edits into the CSV
"""
import csv
import hashlib
import json
import os
import secrets
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "notebook")
CSV_PATH = os.path.join(SITE, "data", "dummy_residents.csv")
PORT = 8000
DEMO_PASSWORD = "elmina123"          # for the original 500 dummy residents
EXTRA = ["name", "email", "password_hash"]
PRIVATE = {"email", "password_hash"}  # never sent to the browser
EDITABLE = {"name", "precinct", "leave_time", "leave_min", "destination", "shift_willing",
            "school_run", "school", "carpool", "frustration"}
PRECINCT_XY = {"Elmina East": (3.1890, 101.5020), "Elmina West": (3.1840, 101.4770),
               "Elmina Valley": (3.1760, 101.4880), "Elmina Green": (3.1925, 101.4890),
               "Elmina Ridge": (3.1720, 101.4740)}
lock = threading.Lock()


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()
    return salt + "$" + h


def check_pw(pw, stored):
    if not stored:
        return pw == DEMO_PASSWORD
    salt = stored.split("$")[0]
    return secrets.compare_digest(hash_pw(pw, salt), stored)


def load():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        cols = list(reader.fieldnames)
    for c in EXTRA:
        if c not in cols:
            cols.append(c)
    for r in rows:
        for c in cols:
            r.setdefault(c, "")
    return cols, rows


def save(cols, rows):
    tmp = CSV_PATH + ".tmp"
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, CSV_PATH)


def public(r):
    out = {k: v for k, v in r.items() if k not in PRIVATE}
    out["source"] = "signup" if r.get("password_hash") else "csv"   # joined through the app?
    return out


def find(rows, key):
    key = (key or "").strip()
    for r in rows:
        if r["resident_id"].upper() == key.upper() or (r["email"] and r["email"].lower() == key.lower()):
            return r
    return None


def to_min(t):
    h, m = t.split(":")
    return str(int(h) * 60 + int(m))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SITE, **kw)

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/ping":
            return self.send_json(200, {"ok": True})
        if path == "/api/residents":
            with lock:
                _, rows = load()
            return self.send_json(200, [public(r) for r in rows])
        if path.endswith("dummy_residents.csv"):   # keep password hashes private
            return self.send_json(403, {"ok": False, "msg": "Use /api/residents"})
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self.send_json(400, {"ok": False, "msg": "Bad request"})

        with lock:
            cols, rows = load()

            if path == "/api/signin":
                r = find(rows, data.get("id"))
                if not r:
                    return self.send_json(200, {"ok": False, "msg": "We could not find that resident ID or email."})
                if not check_pw(data.get("password", ""), r["password_hash"]):
                    hint = " For demo residents it is " + DEMO_PASSWORD + "." if not r["password_hash"] else ""
                    return self.send_json(200, {"ok": False, "msg": "Wrong password." + hint})
                return self.send_json(200, {"ok": True, "user": public(r)})

            if path == "/api/signup":
                name = (data.get("name") or "").strip()
                email = (data.get("email") or "").strip()
                pw = data.get("password") or ""
                if not name or "@" not in email or len(pw) < 6:
                    return self.send_json(200, {"ok": False, "msg": "Please fill in name, email and a 6+ character password."})
                if any(r["email"].lower() == email.lower() for r in rows if r["email"]):
                    return self.send_json(200, {"ok": False, "msg": "That email already has an account. Please sign in."})
                nxt = max(int(r["resident_id"][1:]) for r in rows) + 1
                lat, lon = PRECINCT_XY.get(data.get("precinct"), (3.18, 101.49))
                lat += secrets.randbelow(400) / 100000 - 0.002   # spread homes a little inside the precinct
                lon += secrets.randbelow(400) / 100000 - 0.002
                school_run = data.get("school_run", "No")
                new = {c: "" for c in cols}
                new.update({
                    "resident_id": f"R{nxt:04d}", "precinct": data.get("precinct", ""),
                    "lat": f"{lat:.5f}", "lon": f"{lon:.5f}", "school_run": school_run,
                    "school": data.get("school", "") if school_run == "Yes" else "",
                    "leave_time": data.get("leave_time", "7:10"), "leave_min": to_min(data.get("leave_time", "7:10")),
                    "destination": data.get("destination", ""), "shift_willing": data.get("shift_willing", ""),
                    "carpool": data.get("carpool", "") if school_run == "Yes" else "",
                    "frustration": str(data.get("frustration", 3)),
                    "name": name, "email": email, "password_hash": hash_pw(pw),
                })
                rows.append(new)
                save(cols, rows)
                print(f"  NEW RESIDENT saved to CSV: {new['resident_id']} {name} ({new['precinct']})")
                return self.send_json(200, {"ok": True, "user": public(new)})

            if path == "/api/profile":
                r = find(rows, data.get("id"))
                if not r:
                    return self.send_json(200, {"ok": False, "msg": "Resident not found."})
                ch = {k: str(v) for k, v in (data.get("changes") or {}).items() if k in EDITABLE}
                if ch.get("school_run") == "No":
                    ch["school"], ch["carpool"] = "", ""
                if "leave_time" in ch:
                    ch["leave_min"] = to_min(ch["leave_time"])
                r.update(ch)
                save(cols, rows)
                print(f"  PROFILE updated in CSV: {r['resident_id']}")
                return self.send_json(200, {"ok": True, "user": public(r)})

        return self.send_json(404, {"ok": False, "msg": "Unknown API"})


if __name__ == "__main__":
    if not os.path.exists(CSV_PATH):
        raise SystemExit("Missing notebook/data/dummy_residents.csv. Run: cp prediction/dummy_residents.csv notebook/data/")
    print(f"GerakBijak server running on port {PORT}. Sign-ups are saved to {CSV_PATH}")
    print("Press Ctrl+C to stop.")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()