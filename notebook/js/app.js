(async function () {
  const $ = (id) => document.getElementById(id);
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  // "7:00" and "07:00" count as the same time
  const sameTime = (a, b) => a && b && toMin(a) === toMin(b);
  let data = null, joined = false;

  // 1. Get the signed-in resident (requireUser sends them to login.html if not signed in)
  let user = null;
  try {
    user = await GB.requireUser();
  } catch (err) {
    return;
  }
  const first = String(user.name || "Resident").split(" ")[0];

  // 2. Greeting
  const helloEl = document.querySelector(".hello");
  if (helloEl) helloEl.textContent = "Selamat pagi, " + first;

  // Tomorrow's date (next weekday)
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  if ($("gb-day")) $("gb-day").textContent = "Tomorrow, " + d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  // 3. Carpool: real neighbours from the resident list (same school, open to sharing, nearest first)
  function metres(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  async function carpool() {
    const title = $("gb-carpool-school-title"), sub = $("gb-carpool-subtext");
    const people = $("gb-carpool-people");
    const todayTitle = $("gb-cp-title"), todaySub = $("gb-cp-sub");
    const setText = (el, t) => { if (el) el.textContent = t; };

    setText($("gb-carpool-name"), "You (" + first + ")");
    setText($("gb-carpool-avatar"), GB.initials(user.name || "R"));
    setText($("gb-carpool-precinct"), user.precinct || "");
    setText($("gb-carpool-kids"), "Driver");
    if (people) people.innerHTML = "";

    // Hide the rota and stats until there is a group
    const showGroup = (on) => ["gb-rota-card", "gb-cp-stats", "gb-join"].forEach((id) => { if ($(id)) $(id).classList.toggle("hide", !on); });

    if (user.school_run !== "Yes" || !user.school) {
      setText(title, "No school run");
      setText(sub, "Add your school in My profile and we will match you with neighbours.");
      setText(todayTitle, "No school run in your profile");
      setText(todaySub, "Add one in your profile to find carpools");
      showGroup(false);
      return;
    }

    const all = await GB.residents();
    const home = { lat: +user.lat, lon: +user.lon };
    const matches = all
      .filter((r) => r.resident_id !== user.resident_id && r.school === user.school && (r.carpool === "Yes" || r.carpool === "Maybe"))
      .map((r) => Object.assign({ m: metres(home, { lat: +r.lat, lon: +r.lon }) }, r))
      .sort((a, b) => a.m - b.m)
      .slice(0, 2);

    const leave = user.leave_time || "";
    const far = matches.length ? Math.round(matches[matches.length - 1].m / 50) * 50 : 0;
    const fam = matches.length + " " + (matches.length === 1 ? "family" : "families");

    if (title) title.innerHTML = user.school + "<br>leave about " + leave;
    setText(sub, matches.length
      ? (matches.length + 1) + " households near " + user.precinct + ", all within " + Math.max(far, 50) + " m"
      : "No neighbours matched yet. We will tell you when one signs up.");
    setText(todayTitle, matches.length ? fam + " can share your school run" : "No carpool match yet");
    setText(todaySub, user.school + ", leaving about " + leave);
    showGroup(matches.length > 0);
    if (!matches.length) return;

    // Neighbour rows
    const colors = ["#9A3412", "#4C5A86"];
    matches.forEach((r, k) => {
      const div = document.createElement("div");
      div.className = "person";
      div.innerHTML = '<div class="avatar" style="background:' + colors[k] + ';">N' + (k + 1) + '</div>' +
        '<div style="flex:1;"><b>Neighbour ' + (k + 1) + '</b><div style="font-size:13px;color:var(--muted);">' +
        (Math.round(r.m / 10) * 10) + " m away, leaves " + r.leave_time + "</div></div>" +
        '<span class="pill teal">' + (r.carpool === "Yes" ? "Keen" : "Maybe") + "</span>";
      if (people) people.appendChild(div);
    });

    // Who drives this week: take turns, You first
    const drivers = ["You"].concat(matches.map((_, k) => "N" + (k + 1)));
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"], full = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    if ($("gb-rota")) $("gb-rota").innerHTML = days.map((day, k) => {
      const who = drivers[k % drivers.length];
      return '<div class="' + (who === "You" ? "me" : "") + '">' + day + "<b>" + who + "</b></div>";
    }).join("");
    const mine = full.filter((_, k) => drivers[k % drivers.length] === "You");
    setText($("gb-rota-text"), "You drive " + mine.join(" and ").replace(/ and (?=.* and )/g, ", ") + ". Swap a day anytime from the group chat.");

    // Stats: one car saved per neighbour who shares, distance to the furthest one
    setText($("gb-cp-cars"), matches.length + (matches.length === 1 ? " car" : " cars"));
    setText($("gb-cp-far"), Math.max(far, 50) + " m");
  }

  // 4. Trip prediction
  function show() {
    const o = $("gb-origin").value, dest = $("gb-destination").value;
    const r = data.routes[o + "|" + dest];
    if (!r) {
      if ($("gb-route")) $("gb-route").textContent = "No prediction yet for " + o + " to " + dest + ".";
      return;
    }
    const usual = $("gb-usual").value, i = r.times.indexOf(usual);
    const usualMin = i >= 0 ? r.minutes[i] : r.peak_min;
    let b = i >= 0 ? i : 0;
    for (let k = 0; k < r.times.length; k++) {
      const diff = toMin(usual) - toMin(r.times[k]);
      if (diff >= 0 && diff <= 20 && r.minutes[k] < r.minutes[b]) b = k;
    }
    const saved = Math.max(0, usualMin - r.minutes[b]);
    $("gb-best").textContent = r.times[b];
    $("gb-slot").textContent = "Slot " + r.times[b];
    $("gb-route").textContent = "From " + o + " to " + dest + ". Leave at " + r.times[b] + " for a smoother trip.";
    $("gb-best-min").textContent = Math.round(r.minutes[b]) + " min";
    $("gb-usual-min").textContent = Math.round(usualMin) + " min";
    $("gb-usual-lbl").textContent = "If you leave " + usual;
    $("gb-saved").textContent = saved >= 0.5 ? saved.toFixed(1) + " min" : "0 min";

    const inRush = r.rush_from && toMin(r.times[b]) >= toMin(r.rush_from) && toMin(r.times[b]) <= toMin(r.rush_to);
    $("gb-dot").style.background = inRush ? "#EAB308" : "#16A34A";
    $("gb-traffic").innerHTML = r.rush_from
      ? "<b>Morning rush</b> " + r.rush_from + " to " + r.rush_to + " (up to " + r.rush_adds_pct + "% longer)"
      : "<b>Busiest</b> at " + r.peak_time;
    $("gb-done-title").textContent = "Left on time at " + r.times[b];
    $("gb-waze").href = "https://waze.com/ul?q=" + encodeURIComponent(dest) + "&navigate=yes";
    $("gb-gmaps").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest);

    // Bars: 7 time slots around the usual time
    const u = i >= 0 ? i : b, start = Math.max(0, Math.min(u - 5, r.times.length - 7));
    const slice = r.times.slice(start, start + 7).map((t, k) => ({ t, m: r.minutes[start + k], idx: start + k }));
    const lo = Math.min(...slice.map((s) => s.m)) - 2, hi = Math.max(...slice.map((s) => s.m));
    $("gb-bars").innerHTML = slice.map((s) =>
      '<div title="' + s.t + ": " + s.m + ' min" style="height:' + Math.round(20 + 76 * (s.m - lo) / Math.max(1, hi - lo)) + "px;background:" +
      (s.idx === b ? "#0D6B58" : s.idx === u ? "#E0703A" : "#D3D7D3") + ';"></div>').join("");
    $("gb-ticks").innerHTML = slice.map((s) => '<span style="' + (s.idx === b ? "color:#0D6B58;font-weight:800;" : "") + '">' + s.t + "</span>").join("");
  }

  // Fill the "I usually leave at" list for the chosen route, keeping the resident's time if possible
  function fillTimes(preferred) {
    const r = data.routes[$("gb-origin").value + "|" + $("gb-destination").value];
    $("gb-usual").innerHTML = "";
    if (!r) return;
    r.times.forEach((t) => $("gb-usual").add(new Option(t, t)));
    const match = r.times.find((t) => sameTime(t, preferred));
    $("gb-usual").value = match || r.peak_time;
  }

  function tab(name) {
    ["today", "carpool"].forEach((t) => { if ($("tab-" + t)) $("tab-" + t).classList.toggle("hide", t !== name); });
    document.querySelectorAll("nav button[data-tab]").forEach((x) => x.classList.toggle("on", x.dataset.tab === name));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button[data-tab]").forEach((x) => (x.onclick = () => tab(x.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach((x) => (x.onclick = () => tab(x.dataset.go)));

  if ($("gb-leave")) $("gb-leave").onclick = () => { $("gb-plan").classList.add("hide"); $("gb-done").classList.remove("hide"); };
  if ($("gb-undo")) $("gb-undo").onclick = () => { $("gb-done").classList.add("hide"); $("gb-plan").classList.remove("hide"); };
  if ($("gb-join")) $("gb-join").onclick = () => { joined = !joined; $("gb-join").textContent = joined ? "Request sent. Tap to cancel" : "Join this group"; };

  carpool().catch((e) => console.error("Carpool:", e));

  fetch("data/gerakbijak_data.json")
    .then((res) => res.json())
    .then((json) => {
      data = json;
      data.origins.forEach((o) => $("gb-origin").add(new Option(o, o)));
      data.destinations.forEach((x) => $("gb-destination").add(new Option(x, x)));

      // From: the collected route closest to the resident's precinct
      const origin = GB.originFor(user.precinct);
      $("gb-origin").value = data.origins.includes(origin) ? origin : data.origins[0];

      // To: the school if it is a predicted destination, otherwise their workplace
      const picks = [user.school_run === "Yes" ? user.school : "", user.destination].filter(Boolean);
      const dest = picks.find((p) => data.destinations.includes(p));
      $("gb-destination").value = dest || data.destinations[0];
      if (!dest) console.warn("No prediction for this resident's destination:", picks.join(" / "), "- showing", data.destinations[0]);

      fillTimes(user.leave_time);
      $("gb-origin").addEventListener("change", () => { fillTimes($("gb-usual").value); show(); });
      $("gb-destination").addEventListener("change", () => { fillTimes($("gb-usual").value); show(); });
      $("gb-usual").addEventListener("change", show);
      show();
    })
    .catch((e) => {
      if ($("gb-error")) $("gb-error").textContent = "Could not load trip data. Please try again later.";
      console.error(e);
    });
})();