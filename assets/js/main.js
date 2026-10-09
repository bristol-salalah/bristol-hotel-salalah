(function () {
  var PHONE = "96897260111";
  var isAr = document.documentElement.lang === "ar";
  var T = isAr ? {
    hello: "مرحباً فندق بريستول صلالة، أود الحجز:",
    room: "الغرفة", in: "تاريخ الوصول", out: "تاريخ المغادرة", guests: "عدد الضيوف", adult1: "بالغ واحد", adult2: "بالغان", adultN: "{n} بالغين", child1: "طفل واحد", child2: "طفلان", childN: "{n} أطفال", agesLbl: "الأعمار", under1: "أقل من سنة", sep: "، ", nights: "ليالٍ", night1: "ليلة واحدة", night2: "ليلتان", loc: "ar-OM",
    ask: "هل الغرفة متاحة وما هو السعر؟ شكراً",
    general: "مرحباً فندق بريستول صلالة، أود الاستفسار عن الحجز.",
    pickDates: "يرجى اختيار تاريخ الوصول والمغادرة",
    badDates: "يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول",
    open: "فتح القائمة", close: "إغلاق القائمة"
  } : {
    hello: "Hi Bristol Hotel Salalah, I'd like to book:",
    room: "Room", in: "Check-in", out: "Check-out", guests: "Guests", adult1: "1 adult", adult2: "2 adults", adultN: "{n} adults", child1: "1 child", child2: "2 children", childN: "{n} children", agesLbl: "ages", under1: "under 1", sep: ", ", nights: "nights", night1: "1 night", night2: "2 nights", loc: "en-GB",
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

  // estimate: nights x "from" price of the chosen room
  var est = document.getElementById("estimate");
  function updateEstimate() {
    if (!est || !froom || !fin || !fout) return;
    var opt = froom.options[froom.selectedIndex], price = opt ? +opt.getAttribute("data-price") : 0;
    var nights = (fin.value && fout.value) ? Math.round((new Date(fout.value) - new Date(fin.value)) / 86400000) : 0;
    if (!price || nights < 1) { est.innerHTML = ""; return; }
    var tpl = form.getAttribute(nights === 1 ? "data-t-est1" : nights === 2 ? "data-t-est2" : "data-t-est") || form.getAttribute("data-t-est") || "";
    est.innerHTML = tpl.replace("{n}", nights).replace("${total}", "<strong>$" + (nights * price) + "</strong>");
  }

  // guests: adults + children, one age picker per child, and a gentle note when the room is small
  var fadults = document.getElementById("f-adults"), fchildren = document.getElementById("f-children");
  var agesBox = document.getElementById("f-ages"), capNote = document.getElementById("capacity");
  function renderAges() {
    if (!agesBox || !fchildren) return;
    var n = +fchildren.value, old = [].map.call(agesBox.querySelectorAll("select"), function (x) { return x.value; });
    agesBox.innerHTML = "";
    for (var i = 1; i <= n; i++) {
      var lab = document.createElement("label"); lab.className = "field field-age";
      lab.appendChild(document.createTextNode((form.getAttribute("data-t-age") || "Age of child {n}").replace("{n}", i)));
      var sel = document.createElement("select"); sel.name = "age" + i; sel.required = true;
      var o = document.createElement("option"); o.value = ""; o.textContent = form.getAttribute("data-t-choose") || "Choose"; sel.appendChild(o);
      o = document.createElement("option"); o.value = "0"; o.textContent = form.getAttribute("data-t-under1") || "Under 1"; sel.appendChild(o);
      for (var a = 1; a <= 17; a++) { o = document.createElement("option"); o.value = String(a); o.textContent = String(a); sel.appendChild(o); }
      if (old[i - 1] !== undefined) sel.value = old[i - 1];
      lab.appendChild(sel); agesBox.appendChild(lab);
    }
    agesBox.hidden = n === 0;
    var msg = form.querySelector(".form-msg"); if (msg && n === 0) msg.textContent = "";
  }
  function checkCapacity() {
    if (!capNote || !froom || !fadults || !fchildren) return;
    var max = +froom.options[froom.selectedIndex].getAttribute("data-max");
    var total = +fadults.value + +fchildren.value;
    var over = max && total > max;
    capNote.hidden = !over;
    capNote.textContent = over ? (form.getAttribute("data-t-cap") || "").replace("{n}", max) : "";
  }

  // room buttons preselect the room and jump to the form
  var froom = document.getElementById("f-room");
  var form = document.getElementById("booking-form");
  if (fchildren) fchildren.addEventListener("change", function () { renderAges(); checkCapacity(); });
  if (fadults) fadults.addEventListener("change", checkCapacity);
  if (froom) froom.addEventListener("change", checkCapacity);
  [froom, fin, fout].forEach(function (el) { if (el) el.addEventListener("change", updateEstimate); });
  updateEstimate();
  document.querySelectorAll("[data-room]").forEach(function (el) {
    el.addEventListener("click", function () {
      if (!froom) return;
      var v = el.getAttribute("data-room");
      for (var i = 0; i < froom.options.length; i++) if (froom.options[i].value === v) froom.selectedIndex = i;
      updateEstimate(); checkCapacity();
      setTimeout(function () { froom.focus({ preventScroll: true }); }, 450);
    });
  });

  // booking form -> WhatsApp with a prefilled message
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!fin.value || !fout.value) { alertInline(form.getAttribute("data-t-pick") || T.pickDates); return; }
    if (fout.value <= fin.value) { alertInline(form.getAttribute("data-t-err") || T.badDates); return; }
    var nights = Math.round((new Date(fout.value) - new Date(fin.value)) / 86400000);
    var ageVals = [].map.call(document.querySelectorAll("#f-ages select"), function (x) { return x.value; });
    if (ageVals.some(function (v) { return v === ""; })) {
      alertInline(form.getAttribute("data-t-ages") || "Please choose the age of each child");
      var firstEmpty = [].filter.call(document.querySelectorAll("#f-ages select"), function (x) { return !x.value; })[0];
      if (firstEmpty) firstEmpty.focus();
      return;
    }
    var msg = T.hello + "\n" +
      T.room + ": " + froom.options[froom.selectedIndex].value + "\n" +
      T.in + ": " + fmt(fin.value) + "\n" +
      T.out + ": " + fmt(fout.value) + " (" + nn(nights) + ")\n" +
      T.guests + ": " + guestText(ageVals) + "\n\n" + T.ask;
    window.open(wa(msg), "_blank", "noopener");
  });

  function fmt(v) {
    var p = v.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return d.toLocaleDateString(T.loc, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); } catch (e) { return v; }
  }
  function plural(n, one, two, many) { return n === 1 ? one : n === 2 ? two : many.replace("{n}", n); }
  function guestText(ageVals) {
    var a = +fadults.value, c = +fchildren.value;
    var t = plural(a, T.adult1, T.adult2, T.adultN);
    if (c > 0) t += T.sep + plural(c, T.child1, T.child2, T.childN) + " (" + T.agesLbl + ": " + ageVals.map(function (v) { return v === "0" ? T.under1 : v; }).join(T.sep) + ")";
    return t;
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
      btn.setAttribute("aria-label", open ? (btn.getAttribute("data-t-close") || T.close) : (btn.getAttribute("data-t-open") || T.open));
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

  // gallery filter tabs
  var gal = document.querySelector("[data-lightbox='gallery']");
  var tabs = document.querySelectorAll(".tabs .tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var f = tab.getAttribute("data-filter");
      tabs.forEach(function (x) { var on = x === tab; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
      if (!gal) return;
      gal.querySelectorAll("figure").forEach(function (fig) {
        var show = f === "all" || fig.getAttribute("data-cat") === f;
        fig.hidden = !show;
        if (show) fig.classList.add("in");
      });
    });
  });

  // lightbox: gallery figures and room photo sets
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = lb.querySelector(".lb-img"), lbCap = lb.querySelector(".lb-cap"), lbCount = lb.querySelector(".lb-count");
    var items = [], idx = 0, lastFocus = null, rtl = document.documentElement.dir === "rtl";
    function show(i) {
      idx = (i + items.length) % items.length;
      lbImg.src = items[idx].src; lbImg.alt = items[idx].alt;
      lbCap.textContent = items[idx].alt; lbCount.textContent = (idx + 1) + " / " + items.length;
      if (items.length > 1) { new Image().src = items[(idx + 1) % items.length].src; new Image().src = items[(idx - 1 + items.length) % items.length].src; }
    }
    function openLb(list, i, trigger) {
      if (!list.length) return;
      items = list; lastFocus = trigger; lb.hidden = false; document.body.classList.add("lb-open");
      setInert(true); show(i); lb.querySelector(".lb-close").focus();
    }
    function closeLb() { lb.hidden = true; document.body.classList.remove("lb-open"); setInert(false); if (lastFocus) lastFocus.focus(); }
    function setInert(on) { document.querySelectorAll("body > :not(#lightbox):not(script)").forEach(function (el) { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); }); }
    function item(img) { return { src: img.src, alt: img.alt }; }  // img.src is the full-size JPEG, srcset holds the smaller WebPs
    if (gal) gal.querySelectorAll("figure").forEach(function (fig) {
      var b = fig.querySelector(".g-open"); if (!b) return;
      b.addEventListener("click", function () {
        var vis = [].filter.call(gal.querySelectorAll("figure"), function (x) { return !x.hidden; });
        openLb(vis.map(function (x) { return item(x.querySelector("img")); }), vis.indexOf(fig), b);
      });
    });
    document.querySelectorAll(".room").forEach(function (card) {
      var b = card.querySelector(".room-photos"); if (!b) return;
      b.addEventListener("click", function () {
        var list = [item(b.querySelector("img"))];
        card.querySelectorAll(".room-more a").forEach(function (a) { list.push({ src: a.href, alt: a.title }); });
        openLb(list, 0, b);
      });
    });
    lb.querySelector(".lb-close").addEventListener("click", closeLb);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(idx - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(idx + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Tab") {
        var f = lb.querySelectorAll("button"), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowRight") show(idx + (rtl ? -1 : 1));
      else if (e.key === "ArrowLeft") show(idx + (rtl ? 1 : -1));
    });
    var touchX = null;
    lb.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 40) show(idx + ((dx < 0) !== rtl ? 1 : -1));
    });
  }

  // guide: place filter, and map pins linked to the cards
  var places = document.querySelectorAll(".place"), pins = document.querySelectorAll(".pin[data-id]");
  document.querySelectorAll(".pfilter .tab").forEach(function (tab, _, all) {
    tab.addEventListener("click", function () {
      var f = tab.getAttribute("data-filter");
      all.forEach(function (x) { var on = x === tab; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
      places.forEach(function (p) { p.hidden = !(f === "all" || p.getAttribute("data-cat") === f); if (!p.hidden) p.classList.add("in"); });
      pins.forEach(function (p) { p.hidden = !(f === "all" || p.getAttribute("data-cat") === f); });
    });
  });
  function hot(id, on) {
    var card = document.getElementById(id), pin = document.querySelector('.pin[data-id="' + id + '"]');
    if (card) card.classList.toggle("is-hot", on);
    if (pin) pin.classList.toggle("is-hot", on);
  }
  pins.forEach(function (pin) {
    var id = pin.getAttribute("data-id");
    pin.addEventListener("click", function () {
      var card = document.getElementById(id); if (!card) return;
      card.classList.add("in");
      card.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      places.forEach(function (p) { p.classList.remove("is-hot"); });
      hot(id, true); setTimeout(function () { hot(id, false); }, 2200);
    });
  });
  places.forEach(function (card) {
    card.addEventListener("mouseenter", function () { hot(card.id, true); });
    card.addEventListener("mouseleave", function () { hot(card.id, false); });
  });

  var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();
