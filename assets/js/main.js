(function () {
  var PHONE = "96897260111";
  var isAr = document.documentElement.lang === "ar";
  var T = isAr ? {
    hello: "مرحباً فندق بريستول صلالة، أود الحجز:",
    room: "الغرفة", in: "تاريخ الوصول", out: "تاريخ المغادرة", guests: "عدد الضيوف", nights: "ليالٍ", night1: "ليلة واحدة", night2: "ليلتان", loc: "ar-OM",
    ask: "هل الغرفة متاحة وما هو السعر؟ شكراً",
    general: "مرحباً فندق بريستول صلالة، أود الاستفسار عن الحجز.",
    pickDates: "يرجى اختيار تاريخ الوصول والمغادرة",
    badDates: "يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول",
    open: "فتح القائمة", close: "إغلاق القائمة"
  } : {
    hello: "Hi Bristol Hotel Salalah, I'd like to book:",
    room: "Room", in: "Check-in", out: "Check-out", guests: "Guests", nights: "nights", night1: "1 night", night2: "2 nights", loc: "en-GB",
    ask: "Is it available, and what's the price? Thank you!",
    general: "Hi Bristol Hotel Salalah, I'd like to ask about a booking.",
    pickDates: "Please choose your check-in and check-out dates",
    badDates: "Check-out must be after check-in",
    open: "Open menu", close: "Close menu"
  };

  function wa(text) { return "https://wa.me/" + PHONE + "?text=" + encodeURIComponent(text); }

  // generic WhatsApp links get a friendly opening line
  document.querySelectorAll("a[data-wa]").forEach(function (a) {
    a.href = wa(T.general);
    a.target = "_blank"; a.rel = "noopener";
  });
  document.querySelectorAll("a[data-wa-fixed]").forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });

  // dates: default to tomorrow -> +2 nights, never in the past
  var fin = document.getElementById("f-in"), fout = document.getElementById("f-out");
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
  if (fin && fout) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var a = new Date(t); a.setDate(a.getDate() + 1);
    var b = new Date(t); b.setDate(b.getDate() + 3);
    fin.min = iso(t); fout.min = iso(a);
    fin.value = iso(a); fout.value = iso(b);
    fin.addEventListener("change", function () {
      if (!fin.value) return;
      var n = new Date(fin.value); n.setDate(n.getDate() + 1);
      fout.min = iso(n);
      if (!fout.value || fout.value <= fin.value) { var m = new Date(fin.value); m.setDate(m.getDate() + 2); fout.value = iso(m); }
    });
  }

  // room buttons preselect the room and jump to the form
  var froom = document.getElementById("f-room");
  document.querySelectorAll("[data-room]").forEach(function (el) {
    el.addEventListener("click", function () {
      if (!froom) return;
      var v = el.getAttribute("data-room");
      for (var i = 0; i < froom.options.length; i++) if (froom.options[i].value === v) froom.selectedIndex = i;
      setTimeout(function () { froom.focus({ preventScroll: true }); }, 450);
    });
  });

  // booking form -> WhatsApp with a prefilled message
  var form = document.getElementById("booking-form");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!fin.value || !fout.value) { alertInline(T.pickDates); return; }
    if (fout.value <= fin.value) { alertInline(T.badDates); return; }
    var nights = Math.round((new Date(fout.value) - new Date(fin.value)) / 86400000);
    var g = document.getElementById("f-guests");
    var msg = T.hello + "\n" +
      T.room + ": " + froom.options[froom.selectedIndex].value + "\n" +
      T.in + ": " + fmt(fin.value) + "\n" +
      T.out + ": " + fmt(fout.value) + " (" + nn(nights) + ")\n" +
      T.guests + ": " + g.options[g.selectedIndex].text + "\n\n" + T.ask;
    window.open(wa(msg), "_blank", "noopener");
  });

  function fmt(v) {
    var p = v.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return d.toLocaleDateString(T.loc, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); } catch (e) { return v; }
  }
  function nn(n) { return n === 1 ? T.night1 : n === 2 ? T.night2 : n + " " + T.nights; }

  function alertInline(text) {
    var n = form.querySelector(".form-msg");
    if (!n) { n = document.createElement("p"); n.className = "form-msg"; n.setAttribute("role", "alert");
      n.style.cssText = "grid-column:1/-1;margin:0;color:#174D45;font-weight:700;font-size:14px"; form.appendChild(n); }
    n.textContent = text;
  }

  // mobile menu
  var btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? T.close : T.open);
    });
    nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }); });
  }

  // reveal on scroll
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  } else { els.forEach(function (el) { el.classList.add("in"); }); }

  // language menu closes on outside click or Escape
  var langs = document.querySelector("details.langs");
  if (langs) {
    document.addEventListener("click", function (e) { if (!langs.contains(e.target)) langs.open = false; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") langs.open = false; });
  }

  var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();
