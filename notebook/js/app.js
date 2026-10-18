(async function () {
  const $ = (id) => document.getElementById(id);
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let data = null, joined = false;

  // 1. Dapatkan user yang sedang log masuk dari GB auth system
  let user = null;
  try {
    user = await GB.requireUser();
  } catch (err) {
    return; // Jika belum login, requireUser akan redirect ke login.html
  }

  // 2. Kemaskini ucapan nama mengikut profil user
  const helloEl = document.querySelector(".hello");
  if (helloEl && user) {
    helloEl.textContent = "Selamat pagi, " + (user.name || "Resident");
  }

  // 3. Kemaskini maklumat Carpool mengikut user yang sedang log masuk
  if (user) {
    const carpoolName = document.getElementById("gb-carpool-name");
    const carpoolAvatar = document.getElementById("gb-carpool-avatar");
    const carpoolPrecinct = document.getElementById("gb-carpool-precinct");

    if (carpoolName) {
      carpoolName.textContent = "You (" + (user.name || "Resident") + ")";
    }
    if (carpoolAvatar) {
      carpoolAvatar.textContent = GB.initials(user.name || "R");
    }
    if (carpoolPrecinct && user.precinct) {
      carpoolPrecinct.textContent = user.precinct;
    }


  const carpoolSchoolTitle = document.getElementById("gb-carpool-school-title");
    const carpoolSubtext = document.getElementById("gb-carpool-subtext");
    
    // Tentukan sekolah: Jika user buat school run, ambil user.school; jika tidak, default ke "SK Denai Alam"
    const userSchool = (user.school_run === "Yes" && user.school) ? user.school : "SK Denai Alam";
    const userPrecinct = user.precinct || "Elmina West";

    if (carpoolSchoolTitle) {
      carpoolSchoolTitle.innerHTML = userSchool + "<br>7:20 drop-off";
    }
    if (carpoolSubtext) {
      carpoolSubtext.textContent = "3 households in " + userPrecinct + ", all within 400 m";
    }
  }

  // Setkan tarikh esok (hari bekerja seterusnya)
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  if ($("gb-day")) {
    $("gb-day").textContent = "Tomorrow, " + d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  function show() {
    const o = $("gb-origin").value, dest = $("gb-destination").value;
    const r = data.routes[o + "|" + dest];
    if (!r) return;
    const usual = $("gb-usual").value, i = r.times.indexOf(usual);
    const usualMin = i >= 0 ? r.minutes[i] : r.peak_min;
    let b = i >= 0 ? i : 0;
    for (let k = 0; k < r.times.length; k++) {
      const diff = toMin(usual) - toMin(r.times[k]);
      if (diff >= 0 && diff <= 20 && r.minutes[k] < r.minutes[b]) b = k;
    }
    const saved = Math.max(0, usualMin - r.minutes[b]);
    if ($("gb-best")) $("gb-best").textContent = r.times[b];
    if ($("gb-slot")) $("gb-slot").textContent = "Slot " + r.times[b];
    if ($("gb-route")) $("gb-route").textContent = "From " + o + " to " + dest + ". Leave at " + r.times[b] + " for a smoother trip.";
    if ($("gb-best-min")) $("gb-best-min").textContent = Math.round(r.minutes[b]) + " min";
    if ($("gb-usual-min")) $("gb-usual-min").textContent = Math.round(usualMin) + " min";
    if ($("gb-usual-lbl")) $("gb-usual-lbl").textContent = "If you leave " + usual;
    if ($("gb-saved")) $("gb-saved").textContent = saved >= 0.5 ? saved.toFixed(1) + " min" : "0 min";
    
    const inRush = r.rush_from && toMin(r.times[b]) >= toMin(r.rush_from) && toMin(r.times[b]) <= toMin(r.rush_to);
    if ($("gb-dot")) $("gb-dot").style.background = inRush ? "#EAB308" : "#16A34A";
    if ($("gb-traffic")) {
      $("gb-traffic").innerHTML = r.rush_from
        ? "<b>Morning rush</b> " + r.rush_from + " to " + r.rush_to + " (up to " + r.rush_adds_pct + "% longer)"
        : "<b>Busiest</b> at " + r.peak_time;
    }
    if ($("gb-done-title")) $("gb-done-title").textContent = "Left on time at " + r.times[b];
    if ($("gb-waze")) $("gb-waze").href = "https://waze.com/ul?q=" + encodeURIComponent(dest) + "&navigate=yes";
    if ($("gb-gmaps")) $("gb-gmaps").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest);

    // Bawaan 7 slot masa di sekitar waktu biasa
    const u = i >= 0 ? i : b, start = Math.max(0, Math.min(u - 5, r.times.length - 7));
    const slice = r.times.slice(start, start + 7).map((t, k) => ({ t, m: r.minutes[start + k], idx: start + k }));
    const lo = Math.min(...slice.map((s) => s.m)) - 2, hi = Math.max(...slice.map((s) => s.m));
    if ($("gb-bars")) {
      $("gb-bars").innerHTML = slice.map((s) =>
        '<div title="' + s.t + ": " + s.m + ' min" style="height:' + Math.round(20 + 76 * (s.m - lo) / Math.max(1, hi - lo)) + 'px;background:' +
        (s.idx === b ? "#0D6B58" : s.idx === u ? "#E0703A" : "#D3D7D3") + ';"></div>').join("");
    }
    if ($("gb-ticks")) {
      $("gb-ticks").innerHTML = slice.map((s) => '<span style="' + (s.idx === b ? "color:#0D6B58;font-weight:800;" : "") + '">' + s.t + "</span>").join("");
    }
  }

  function tab(name) {
    ["today", "carpool"].forEach((t) => {
      if ($(t ? "tab-" + t : "")) $("tab-" + t).classList.toggle("hide", t !== name);
    });
    document.querySelectorAll("nav button[data-tab]").forEach((x) => x.classList.toggle("on", x.dataset.tab === name));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button[data-tab]").forEach((x) => (x.onclick = () => tab(x.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach((x) => (x.onclick = () => tab(x.dataset.go)));

  if ($("gb-leave")) $("gb-leave").onclick = () => { $("gb-plan").classList.add("hide"); $("gb-done").classList.remove("hide"); };
  if ($("gb-undo")) $("gb-undo").onclick = () => { $("gb-done").classList.add("hide"); $("gb-plan").classList.remove("hide"); };
  if ($("gb-join")) $("gb-join").onclick = () => { joined = !joined; $("gb-join").textContent = joined ? "Request sent. Tap to cancel" : "Join this group"; };

  fetch("data/gerakbijak_data.json")
    .then((res) => res.json())
    .then((json) => {
      data = json;
      
      // Isikan Dropdown Origins
      data.origins.forEach((o) => $("gb-origin").add(new Option(o, o)));
      
      // Isikan Dropdown Destinations
      data.destinations.forEach((x) => $("gb-destination").add(new Option(x, x)));

      // 3. Tetapkan nilai laluan & waktu asal berdasarkan data profil user
      const userOrigin = GB.originFor(user.precinct);
      if (data.origins.includes(userOrigin)) {
        $("gb-origin").value = userOrigin;
      }
      
      const userDest = user.school_run === "Yes" && user.school ? user.school : (user.destination || "KL Sentral");
      if (data.destinations.includes(userDest)) {
        $("gb-destination").value = userDest;
      }

      const activeRouteKey = $("gb-origin").value + "|" + $("gb-destination").value;
      const activeRoute = data.routes[activeRouteKey] || data.routes[data.origins[0] + "|KL Sentral"];

      activeRoute.times.forEach((t) => $("gb-usual").add(new Option(t, t)));
      
      if (user.leave_time && activeRoute.times.includes(user.leave_time)) {
        $("gb-usual").value = user.leave_time;
      } else {
        $("gb-usual").value = activeRoute.peak_time;
      }

      ["gb-origin", "gb-destination", "gb-usual"].forEach((id) => {
        if ($(id)) $(id).addEventListener("change", show);
      });
      
      show();
    })
    .catch((e) => {
      if ($("gb-error")) $("gb-error").textContent = "Could not load trip data. Please try again later.";
      console.error(e);
    });
})();