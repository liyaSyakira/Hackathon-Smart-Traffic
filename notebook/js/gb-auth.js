// GerakBijak demo sign-in.
// With server.py running: sign-ups and profile edits are saved into data/dummy_residents.csv.
// With the plain http.server: falls back to saving in this browser (localStorage).
window.GB = (function () {
  const DEMO_PASSWORD = "elmina123";
  const WORK = ["KL Sentral", "Shah Alam (Sek 7)", "Petaling Jaya", "Sungai Buloh"];
  const SCHOOLS = ["SK Denai Alam", "SK Bukit Subang", "SJK(C) Regent Elmina", "SMK Denai Alam"];
  const PRECINCTS = ["Elmina East", "Elmina West", "Elmina Valley", "Elmina Green", "Elmina Ridge"];
  // Fictional first names so dummy residents read naturally (the CSV has no names)
  const NAMES = ["Aina", "Hafiz", "Mei Ling", "Arjun", "Nurul", "Daniel", "Siti", "Kumar", "Farah", "Wei Jie",
                 "Aisyah", "Ravi", "Zul", "Priya", "Iman", "Jason", "Liyana", "Faiz", "Shalini", "Amir"];

  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return mem[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };

  // CSV parser that understands quoted values like "Yes, 20 min"
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    const head = rows.shift();
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
  }

  // Is server.py running? (then we use its API and the CSV gets updated)
  let apiCheck = null;
  function hasApi() {
    if (!apiCheck) apiCheck = fetch("api/ping", { cache: "no-store" }).then((r) => r.ok).catch(() => false);
    return apiCheck;
  }
  async function api(path, body) {
    const res = await fetch("api/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  }
  function withName(r) {
    const n = parseInt(r.resident_id.slice(1), 10) || 1;
    return Object.assign({}, r, { name: r.name || NAMES[(n - 1) % NAMES.length], source: r.source || (r.email ? "signup" : "csv") });
  }

  let cache = null;
  async function residents() {
    if (await hasApi()) {
      const res = await fetch("api/residents", { cache: "no-store" });
      return (await res.json()).map(withName);
    }
    if (!cache) {
      const res = await fetch("data/dummy_residents.csv");
      if (!res.ok) throw new Error("dummy_residents.csv not found in notebook/data");
      cache = parseCSV(await res.text()).map((r) => {
        const n = parseInt(r.resident_id.slice(1), 10) || 1;
        return Object.assign({ name: NAMES[(n - 1) % NAMES.length], email: "", source: "csv" }, r);
      });
    }
    const edits = store.get("gb_edits") || {};
    const added = store.get("gb_users") || [];
    return cache.map((r) => Object.assign({}, r, edits[r.resident_id] || {})).concat(added);
  }

  async function find(id) {
    id = String(id || "").trim().toUpperCase();
    return (await residents()).find((r) => r.resident_id === id || (r.email && r.email.toLowerCase() === id.toLowerCase())) || null;
  }

  async function signIn(idOrEmail, password) {
    if (await hasApi()) {
      const r = await api("signin", { id: idOrEmail, password });
      if (r.ok) store.set("gb_session", r.user.resident_id);
      return r;
    }
    const u = await find(idOrEmail);
    if (!u) return { ok: false, msg: "We could not find that resident ID or email." };
    const pw = u.source === "csv" ? DEMO_PASSWORD : u.password;
    if (password !== pw) return { ok: false, msg: "Wrong password. For demo residents it is " + DEMO_PASSWORD + "." };
    store.set("gb_session", u.resident_id);
    return { ok: true, user: u };
  }

  async function signUp(f) {
    if (await hasApi()) {
      const r = await api("signup", f);
      if (r.ok) store.set("gb_session", r.user.resident_id);
      return r;
    }
    const all = await residents();
    if (f.email && all.some((r) => r.email && r.email.toLowerCase() === f.email.toLowerCase()))
      return { ok: false, msg: "That email already has an account. Please sign in." };
    const next = Math.max(...all.map((r) => parseInt(r.resident_id.slice(1), 10) || 0)) + 1;
    const lat = { "Elmina East": 3.189, "Elmina West": 3.184, "Elmina Valley": 3.176, "Elmina Green": 3.1925, "Elmina Ridge": 3.172 };
    const [h, m] = f.leave_time.split(":").map(Number);
    const u = {
      resident_id: "R" + String(next).padStart(4, "0"), name: f.name, email: f.email, password: f.password, source: "signup",
      precinct: f.precinct, lat: String(lat[f.precinct] || 3.18), lon: "101.49",
      school_run: f.school_run, school: f.school_run === "Yes" ? f.school : "",
      leave_time: f.leave_time, leave_min: String(h * 60 + m), destination: f.destination,
      shift_willing: f.shift_willing, carpool: f.school_run === "Yes" ? f.carpool : "", frustration: f.frustration || "3",
    };
    const added = store.get("gb_users") || [];
    added.push(u); store.set("gb_users", added);
    store.set("gb_session", u.resident_id);
    return { ok: true, user: u };
  }

  async function update(id, changes) {
    if (await hasApi()) return api("profile", { id, changes });
    if (changes.school_run === "No") { changes.school = ""; changes.carpool = ""; }
    if (changes.leave_time) { const [h, m] = changes.leave_time.split(":").map(Number); changes.leave_min = String(h * 60 + m); }
    const added = store.get("gb_users") || [];
    const i = added.findIndex((u) => u.resident_id === id);
    if (i >= 0) { Object.assign(added[i], changes); store.set("gb_users", added); }
    else { const e = store.get("gb_edits") || {}; e[id] = Object.assign(e[id] || {}, changes); store.set("gb_edits", e); }
  }

  // Profile photo: saved on the server (data/photos) or, without server.py, in this browser
  async function setPhoto(id, dataUrl) {
    if (await hasApi()) return api("photo", { id, image: dataUrl });
    store.set("gb_photo_" + id, dataUrl);
    return { ok: true };
  }
  function photoFor(u) { return (u && (u.photo || store.get("gb_photo_" + u.resident_id))) || ""; }
  // Show the photo inside an avatar circle, or the initials if there is no photo
  function paintAvatar(el, u) {
    if (!el || !u) return;
    const pic = photoFor(u);
    el.style.backgroundImage = pic ? 'url("' + pic + '")' : "";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.textContent = pic ? "" : initials(u.name);
  }

  async function current() { const id = store.get("gb_session"); return id ? find(id) : null; }
  async function requireUser() {
    const u = await current();
    if (!u) { location.href = "login.html"; throw new Error("not signed in"); }
    return u;
  }
  function signOut() { store.del("gb_session"); location.href = "login.html"; }

  // Which collected route matches this resident's home
  function originFor(precinct) { return precinct === "Elmina East" ? "Elmina East" : "Elmina Valley"; }
  function initials(name) { return String(name || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(); }

  return { setPhoto, photoFor, paintAvatar, hasApi, DEMO_PASSWORD, WORK, SCHOOLS, PRECINCTS, residents, signIn, signUp, update, current, requireUser, signOut, originFor, initials };
})();