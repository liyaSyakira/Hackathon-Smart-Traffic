(function () {
  const $ = (id) => document.getElementById(id);
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let data = null, joined = false;

  // Tomorrow's date (next weekday)
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  $("gb-day").textContent = "Tomorrow, " + d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

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

    // bars: 7 slots around the usual time
    const u = i >= 0 ? i : b, start = Math.max(0, Math.min(u - 5, r.times.length - 7));
    const slice = r.times.slice(start, start + 7).map((t, k) => ({ t, m: r.minutes[start + k], idx: start + k }));
    const lo = Math.min(...slice.map((s) => s.m)) - 2, hi = Math.max(...slice.map((s) => s.m));
    $("gb-bars").innerHTML = slice.map((s) =>
      '<div title="' + s.t + ": " + s.m + ' min" style="height:' + Math.round(20 + 76 * (s.m - lo) / Math.max(1, hi - lo)) + 'px;background:' +
      (s.idx === b ? "#0D6B58" : s.idx === u ? "#E0703A" : "#D3D7D3") + ';"></div>').join("");
    $("gb-ticks").innerHTML = slice.map((s) => '<span style="' + (s.idx === b ? "color:#0D6B58;font-weight:800;" : "") + '">' + s.t + "</span>").join("");
  }

  function tab(name) {
    ["today", "carpool"].forEach((t) => $("tab-" + t).classList.toggle("hide", t !== name));
    document.querySelectorAll("nav button[data-tab]").forEach((x) => x.classList.toggle("on", x.dataset.tab === name));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button[data-tab]").forEach((x) => (x.onclick = () => tab(x.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach((x) => (x.onclick = () => tab(x.dataset.go)));

  $("gb-leave").onclick = () => { $("gb-plan").classList.add("hide"); $("gb-done").classList.remove("hide"); };
  $("gb-undo").onclick = () => { $("gb-done").classList.add("hide"); $("gb-plan").classList.remove("hide"); };
  $("gb-join").onclick = () => { joined = !joined; $("gb-join").textContent = joined ? "Request sent. Tap to cancel" : "Join this group"; };

  fetch("data/gerakbijak_data.json")
    .then((res) => res.json())
    .then((json) => {
      data = json;
      data.origins.forEach((o) => $("gb-origin").add(new Option(o, o)));
      data.destinations.forEach((x) => $("gb-destination").add(new Option(x, x)));
      $("gb-destination").value = "KL Sentral";
      const first = data.routes[data.origins[0] + "|KL Sentral"];
      first.times.forEach((t) => $("gb-usual").add(new Option(t, t)));
      $("gb-usual").value = first.peak_time;
      ["gb-origin", "gb-destination", "gb-usual"].forEach((id) => $(id).addEventListener("change", show));
      show();
    })
    .catch((e) => { $("gb-error").textContent = "Could not load trip data. Please try again later."; console.error(e); });
})();