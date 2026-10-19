(function () {
    const $ = (id) => document.getElementById(id);
    const fill = (sel, list) => list.forEach((v) => sel.add(new Option(v, v)));
    fill($("e-precinct"), GB.PRECINCTS); fill($("e-dest"), GB.WORK); fill($("e-school"), GB.SCHOOLS);
    for (let m = 390; m <= 510; m += 5) $("e-leave").add(new Option(Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0")));
    $("e-run").onchange = () => $("e-school-box").classList.toggle("hide", $("e-run").value === "No");
  
    let user = null;
    function render(u) {
      $("p-avatar").textContent = GB.initials(u.name);
      $("p-name").textContent = u.name;
      $("p-sub").textContent = "Resident of " + u.precinct;
      $("p-id").textContent = "Resident " + u.resident_id;
      $("v-precinct").textContent = u.precinct;
      $("v-leave").textContent = u.leave_time;
      $("v-dest").textContent = u.destination;
      $("v-shift").textContent = u.shift_willing || "-";
      $("v-run").textContent = u.school_run;
      $("v-school").textContent = u.school || "-";
      $("v-carpool").textContent = u.carpool || "-";
      const s = parseInt(u.frustration, 10) || 0;
      $("v-stress").innerHTML = [1, 2, 3, 4, 5].map((k) => '<i style="background:' + (k <= s ? (s >= 4 ? "#E0703A" : "#0D6B58") : "#F0EDE6") + ';"></i>').join("");
      $("v-stress-t").textContent = s + " of 5. " + (s >= 4 ? "Traffic is one of your biggest daily frustrations." : "Traffic bothers you a little.");
    }
  
    function openEdit() {
      $("e-name").value = user.name; $("e-precinct").value = user.precinct; $("e-leave").value = user.leave_time;
      $("e-dest").value = user.destination; $("e-shift").value = user.shift_willing || "Maybe"; $("e-run").value = user.school_run;
      $("e-school").value = user.school || GB.SCHOOLS[0]; $("e-carpool").value = user.carpool || "Maybe"; $("e-stress").value = user.frustration || "3";
      $("e-school-box").classList.toggle("hide", user.school_run === "No");
      $("view").classList.add("hide"); $("form").classList.remove("hide");
    }
    function closeEdit() { $("form").classList.add("hide"); $("view").classList.remove("hide"); }
  
    $("edit").onclick = openEdit;
    $("cancel").onclick = closeEdit;
    $("out").onclick = () => GB.signOut();
    $("form").onsubmit = async (ev) => {
      ev.preventDefault();
      if (!$("e-name").value.trim()) { $("err").textContent = "Please enter your name."; return; }
      const ch = { name: $("e-name").value.trim(), precinct: $("e-precinct").value, leave_time: $("e-leave").value,
        destination: $("e-dest").value, shift_willing: $("e-shift").value, school_run: $("e-run").value,
        school: $("e-school").value, carpool: $("e-carpool").value, frustration: $("e-stress").value };
      await GB.update(user.resident_id, ch);
      user = await GB.current(); render(user); closeEdit(); $("err").textContent = "";
    };
  
    GB.requireUser().then((u) => { user = u; render(u); })
      .catch((e) => { if (e.message !== "not signed in") $("err").textContent = "Could not load your profile."; });
  })();