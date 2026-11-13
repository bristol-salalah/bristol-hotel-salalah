/* Bristol Hotel Salalah — website dashboard (no dependencies).
   Edits rates.json and the photos in assets/img/photos/, and commits them to GitHub.
   The "Build site" workflow in .github/workflows/ then rebuilds the pages. */
(function () {
  "use strict";

  // The password is unlocked with the browser's own cryptography, which only works over https.
  if (location.protocol === "http:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    location.replace("https://" + location.host + location.pathname + location.search);
    return;
  }

  var REPO = "bristol-salalah/bristol-hotel-salalah";
  var BRANCH = new URLSearchParams(location.search).get("branch") || "main";
  var API = "https://api.github.com/repos/" + REPO;
  var CONTENT_PATH = "rates.json";
  var SITE = "../";
  var KEY = "bristol.admin.key";
  var TABS = [["prices", "Prices"], ["photos", "Photos"]];
  // The rooms, named exactly as in rates.json (the same list as tools/rates.py).
  var ROOMS = ["Deluxe Room", "Junior Suite", "Superior Suite", "Executive Suite"];
  var PRICE = /^\d{1,4}(\.\d{1,3})?$/;

  var app = document.getElementById("app");
  var S = {
    token: null, saved: null, draft: null, sha: null, updated: null,
    slots: [], photos: new Map(), shown: {}, tab: "prices", busy: false, status: null, errors: []
  };

  /* ---------------------------------------------------------------- helpers */
  function h(tag, props) {
    var el = document.createElement(tag), k, v;
    for (k in props || {}) {
      v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(function (x) { add(el, x); });
    else el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function oneLine(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function gh(path, opts) {
    opts = opts || {};
    var headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + S.token, "X-GitHub-Api-Version": "2022-11-28" };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (res) {
        if (res.ok) return res.status === 204 ? null : res.json();
        return res.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || "GitHub answered " + res.status);
          e.status = res.status;
          e.write = !!opts.method && opts.method !== "GET";
          throw e;
        });
      });
  }
  function explain(e) {
    if (e.friendly) return e.message;
    if (e.status === 401) return "The access key behind this login has expired. Please tell Jeevesh.";
    if (e.write && (e.status === 403 || e.status === 404)) return "This access key can open the dashboard but is not allowed to publish. Ask Jeevesh for a new key.";
    if (e.status === 409 || e.status === 422) return "Someone else published at the same moment. Reload the page and try again.";
    if (e.status === 403 || e.status === 429) return "GitHub is asking us to slow down. Wait a minute and try again.";
    if (e.status === 404) return "The website's files could not be found with this access key. Ask Jeevesh to check the key.";
    if (e instanceof TypeError) return "No internet connection, or GitHub could not be reached. Check your connection and try again.";
    return "Something went wrong: " + e.message;
  }
  function friendly(msg) { var e = new Error(msg); e.friendly = true; return e; }

  function b64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = function () { rej(friendly("The photo could not be read from your device.")); };
      r.readAsDataURL(blob);
    });
  }
  function fromB64(s) {
    var bin = atob(s.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------------------------------------------------------------- loading */
  function loadContent() {
    return gh("/contents/" + CONTENT_PATH + "?ref=" + encodeURIComponent(BRANCH)).then(function (f) {
      var c = JSON.parse(fromB64(f.content));
      S.sha = f.sha;
      S.updated = c.updated || null;
      delete c.updated;
      S.saved = c;
      S.draft = clone(c);
    });
  }

  // The hotel's photos on the page, with the size of each, listed when the site is built
  // (tools/dashboard.py). A new photo keeps the size of the one it replaces.
  function loadSlots() {
    return fetch("photos.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw friendly("The list of the website's photos could not be loaded.");
      return r.json();
    }).then(function (list) { S.slots = list; });
  }

  /* ---------------------------------------------------------------- checks (the same rules as tools/rates.py) */
  function normalise(c) { return c; }
  function price(v, zeroOk) { return typeof v === "number" && isFinite(v) && (zeroOk ? v >= 0 : v > 0) && v <= 9999; }
  function validate(c) {
    var errs = [];
    ROOMS.forEach(function (name) {
      if (!price(c.rooms[name])) errs.push({ tab: "prices", msg: name + ": enter the price in rials, such as 16 or 12.5." });
    });
    if (!price(c.breakfast_per_person, true)) errs.push({ tab: "prices", msg: "Breakfast: enter the price in rials, such as 2." });
    return errs;
  }

  /* ---------------------------------------------------------------- what changed */
  function changes() {
    var out = [], d = S.draft, s = S.saved;
    if (!same(d.rooms, s.rooms) || !same(d.breakfast_per_person, s.breakfast_per_person)) out.push("prices");
    if (S.photos.size) out.push(plural(S.photos.size, "photo"));
    return out;
  }
  function dirty() { return !!S.draft && changes().length > 0; }
  window.addEventListener("beforeunload", function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------------------------------------------------------------- photos */
  function decode(file) {
    var viaTag = function () {
      return new Promise(function (res, rej) {
        var img = new Image(), u = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(u); res(img); };
        img.onerror = function () { URL.revokeObjectURL(u); rej(friendly("This file could not be opened as a photo. Try a JPG or PNG.")); };
        img.src = u;
      });
    };
    if (!window.createImageBitmap) return viaTag();
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(viaTag);
  }
  // Fill w × h from the middle of the photo, the way the page itself crops it.
  function cover(src, w, ht) {
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    var scale = Math.max(w / sw, ht / sh), cw = w / scale, ch = ht / scale;
    var c = document.createElement("canvas");
    c.width = w; c.height = ht;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, ht);
    return new Promise(function (res, rej) {
      c.toBlob(function (b) { b ? res(b) : rej(friendly("The photo could not be prepared on this device.")); }, "image/jpeg", 0.85);
    });
  }
  function choosePhoto(slot, file) {
    if (!file) return;
    S.status = null;
    decode(file).then(function (src) {
      var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
      return cover(src, slot.w, slot.h).then(function (blob) {
        var old = S.photos.get(slot.path);
        if (old) URL.revokeObjectURL(old.url);
        S.photos.set(slot.path, {
          full: blob, url: URL.createObjectURL(blob),
          blurry: sw < slot.w || sh < slot.h ? sw + " × " + sh : null
        });
        if (src.close) src.close();
        render();
      });
    }).catch(function (e) { S.status = { kind: "bad", text: explain(e) }; render(); });
  }
  function undoPhoto(slot) {
    var p = S.photos.get(slot.path);
    if (p) URL.revokeObjectURL(p.url);
    S.photos.delete(slot.path);
    render();
  }

  /* ---------------------------------------------------------------- publish */
  function publish() {
    if (S.busy) return;
    normalise(S.draft);
    S.errors = validate(S.draft);
    if (S.errors.length) {
      S.tab = S.errors[0].tab;
      S.status = null;
      render();
      window.scrollTo(0, 0);
      return;
    }
    var what = changes(), stamp = new Date().toISOString(), head, commitSha;
    var content = Object.assign({}, S.draft, { updated: stamp });
    S.busy = true;
    S.status = { kind: "work", text: "Saving your changes…" };
    render();

    gh("/git/ref/heads/" + encodeURIComponent(BRANCH)).then(function (ref) {
      head = ref.object.sha;
      return gh("/contents/" + CONTENT_PATH + "?ref=" + head);
    }).then(function (cur) {
      if (cur.sha !== S.sha) throw friendly("The website was changed somewhere else since you opened this page. Reload the page to see the latest version, then make your changes again.");
      return gh("/git/commits/" + head);
    }).then(function (commit) {
      var tree = [{ path: CONTENT_PATH, mode: "100644", type: "blob", content: JSON.stringify(content, null, 1) + "\n" }];
      var files = [];
      S.photos.forEach(function (p, path) { files.push([path, p.full]); });
      var chain = Promise.resolve();
      files.forEach(function (f, i) {
        chain = chain.then(function () {
          S.status = { kind: "work", text: "Uploading photo " + (i + 1) + " of " + files.length + "…" };
          render();
          return b64(f[1]);
        }).then(function (data) {
          return gh("/git/blobs", { method: "POST", body: { content: data, encoding: "base64" } });
        }).then(function (blob) {
          tree.push({ path: f[0], mode: "100644", type: "blob", sha: blob.sha });
        });
      });
      return chain.then(function () {
        S.status = { kind: "work", text: "Saving your changes…" };
        render();
        return gh("/git/trees", { method: "POST", body: { base_tree: commit.tree.sha, tree: tree } });
      });
    }).then(function (tree) {
      return gh("/git/commits", { method: "POST", body: { message: "Dashboard: " + what.join(", "), tree: tree.sha, parents: [head] } });
    }).then(function (commit) {
      commitSha = commit.sha;
      return gh("/git/refs/heads/" + encodeURIComponent(BRANCH), { method: "PATCH", body: { sha: commitSha } });
    }).then(function () {
      return gh("/contents/" + CONTENT_PATH + "?ref=" + commitSha);
    }).then(function (f) {
      S.sha = f.sha;
      S.saved = clone(S.draft);
      S.updated = stamp;
      S.photos.forEach(function (p, path) { S.shown[path] = p.url; });
      S.photos.clear();
      S.busy = false;
      S.status = { kind: "work", text: "Saved. Now updating the website. This takes about three minutes…" };
      render();
      watch(stamp, commitSha);
    }).catch(function (e) {
      S.busy = false;
      S.status = { kind: "bad", text: explain(e) + " Nothing was published." };
      render();
    });
  }

  // Wait until the live site serves the version just saved. Also ask GitHub whether the
  // build failed, so a failure is shown instead of waiting for nothing.
  function watch(stamp, commitSha) {
    var started = Date.now(), tries = 0;
    function done(kind, text, link) {
      if (S.updated !== stamp) return; // a newer publish has taken over
      S.status = { kind: kind, text: text, link: link };
      render();
    }
    function tick() {
      if (S.updated !== stamp) return;
      tries++;
      fetch("built.json?v=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (live) {
        if (live.updated === stamp) return done("good", "Your changes are live on the website.", true);
        var failed = tries % 3 ? Promise.resolve(false) : gh("/actions/runs?per_page=5&head_sha=" + commitSha).then(function (j) {
          return (j.workflow_runs || []).some(function (run) { return run.conclusion === "failure" || run.conclusion === "cancelled" || run.conclusion === "timed_out"; });
        }).catch(function () { return false; });
        return failed.then(function (bad) {
          if (bad) return done("bad", "Your changes are saved, but the website could not be rebuilt, so visitors still see the old version. Please tell Jeevesh.");
          if (Date.now() - started > 12 * 60000) return done("warn", "Your changes are saved, but the website is taking longer than usual to update. Check the site in a few minutes, and tell Jeevesh if it still shows the old version.", true);
          setTimeout(tick, 5000);
        });
      });
    }
    setTimeout(tick, 45000);
  }

  function discard() {
    S.draft = clone(S.saved);
    S.photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    S.photos.clear();
    S.errors = [];
    S.status = null;
    render();
  }

  /* ---------------------------------------------------------------- views */
  function field(label, input, hint) {
    return h("label", { class: "field" }, h("span", { class: "lbl", text: label }), input, hint ? h("span", { class: "hint", text: hint }) : null);
  }
  function priceInput(value, onChange, label) {
    return h("input", {
      type: "text", inputmode: "decimal", class: "num", maxlength: 8, value: value == null ? "" : String(value), "aria-label": label,
      oninput: function (e) {
        var raw = e.target.value.trim().replace(",", ".");
        // What is not a number is kept as typed, so it counts as a change and the check before publishing names it.
        onChange(PRICE.test(raw) ? parseFloat(raw) : raw);
        bar();
      }
    });
  }
  function viewPrices() {
    var d = S.draft;
    function line(name, hint, value, set) {
      return h("label", { class: "line room" },
        h("span", { class: "name" }, name, hint ? h("small", { text: hint }) : null),
        h("span", { class: "money" }, h("span", { class: "unit", text: "OMR" }), priceInput(value, set, name + ", price in Omani rials")));
    }
    return h("section", null,
      h("p", { class: "intro", text: "Prices in Omani rials, for one room for one night, before taxes. Use a dot for halves: 12.5." }),
      h("div", { class: "card" }, ROOMS.map(function (name) {
        return line(name, "", d.rooms[name], function (v) { d.rooms[name] = v; });
      })),
      h("div", { class: "card" }, line("Breakfast", "For one person", d.breakfast_per_person, function (v) { d.breakfast_per_person = v; })),
      h("p", { class: "note", text: "The new prices appear on the room cards, in the booking form, on the “from OMR” badge at the top of the page and on the breakfast lines, in every language." }));
  }

  function viewPhotos() {
    var groups = [], by = {};
    S.slots.forEach(function (s) {
      if (!by[s.group]) { by[s.group] = []; groups.push(s.group); }
      by[s.group].push(s);
    });
    return h("section", null,
      h("p", { class: "intro", text: "Choose a new photo and it takes the place of the old one. It is cut to the same shape, from the middle, so check the preview before you publish." }),
      groups.map(function (g) {
        return h("div", { class: "group" }, h("h2", { text: g }),
          h("div", { class: "photos" }, by[g].map(function (s) {
            var p = S.photos.get(s.path);
            var input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", class: "sr", onchange: function (e) { choosePhoto(s, e.target.files[0]); e.target.value = ""; } });
            return h("figure", { class: "photo" + (p ? " new" : "") },
              h("div", { class: "frame", style: null },
                h("img", { src: p ? p.url : S.shown[s.path] || SITE + s.thumb, alt: "", loading: "lazy", width: s.w, height: s.h }),
                p ? h("span", { class: "badge", text: "New, not published" }) : null),
              h("figcaption", null,
                h("b", { text: s.label }),
                p && p.blurry ? h("span", { class: "hint warn", text: "This photo is small (" + p.blurry + ") and may look blurry. Best is " + s.w + " × " + s.h + " or larger." }) : null,
                h("span", { class: "photo-btns" },
                  h("label", { class: "btn small" }, input, p ? "Choose another" : "Replace"),
                  p ? h("button", { type: "button", class: "btn small ghost", onclick: function () { undoPhoto(s); } }, "Undo") : null)));
          })));
      }));
  }

  var VIEWS = { prices: viewPrices, photos: viewPhotos };

  function statusBox() {
    var s = S.status;
    if (!s) return null;
    return h("div", { class: "status " + s.kind, role: s.kind === "bad" ? "alert" : "status" },
      s.kind === "work" ? h("span", { class: "spin", "aria-hidden": "true" }) : null,
      h("span", { text: s.text }),
      s.link ? h("a", { href: SITE, target: "_blank", rel: "noopener", text: "View the website" }) : null);
  }
  function errorBox() {
    var here = S.errors;
    if (!here.length) return null;
    return h("div", { class: "status bad", role: "alert" },
      h("div", null, h("b", { text: "Please fix this before publishing:" }),
        h("ul", null, here.slice(0, 8).map(function (e) { return h("li", { text: e.msg }); }),
          here.length > 8 ? h("li", { text: "…and " + (here.length - 8) + " more." }) : null)));
  }

  // The bar at the bottom is redrawn on every keystroke; the rest only when the structure changes.
  var barEl = null;
  function bar() {
    if (!barEl) return;
    var what = changes();
    barEl.hidden = !what.length && !S.busy;
    barEl.replaceChildren(
      h("span", { class: "what", text: S.busy ? "Publishing…" : "Changed: " + what.join(", ") }),
      h("span", { class: "bar-btns" },
        h("button", { type: "button", class: "btn ghost light", disabled: S.busy, onclick: function () { if (confirmDiscard()) discard(); } }, "Discard"),
        h("button", { type: "button", class: "btn primary", disabled: S.busy, onclick: publish }, "Publish")));
    document.body.classList.toggle("has-bar", !barEl.hidden);
  }
  function confirmDiscard() { return window.confirm("Throw away the changes you have not published?"); }

  function render() {
    if (!S.token) return renderSignIn();
    if (!S.draft) return;
    var when = S.updated ? new Date(S.updated).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    barEl = h("div", { class: "bar", hidden: true });
    app.replaceChildren(
      h("header", { class: "top" },
        h("div", { class: "wrap" },
          h("div", { class: "brand" }, h("img", { src: SITE + "assets/img/logo-light.png", alt: "Bristol Hotel Salalah", width: 499, height: 136 }),
            h("span", { text: "Website dashboard" })),
          h("div", { class: "top-links" },
            h("a", { href: SITE, target: "_blank", rel: "noopener", text: "View site" }),
            h("button", { type: "button", class: "link", onclick: signOut }, "Sign out")))),
      h("nav", { class: "tabs", "aria-label": "Sections" },
        h("div", { class: "wrap" }, TABS.map(function (t) {
          return h("button", {
            type: "button", class: S.tab === t[0] ? "on" : null, "aria-current": S.tab === t[0] ? "page" : null,
            onclick: function () { S.tab = t[0]; render(); window.scrollTo(0, 0); }
          }, t[1]);
        }))),
      h("main", { class: "wrap" },
        BRANCH !== "main" ? h("div", { class: "status warn" }, h("span", { text: "Test mode: changes go to the “" + BRANCH + "” branch, not to the live website." })) : null,
        statusBox(), errorBox(),
        h("h1", { text: TABS.filter(function (t) { return t[0] === S.tab; })[0][1] }),
        VIEWS[S.tab](),
        when ? h("p", { class: "foot", text: "Last published from this dashboard: " + when }) : null),
      barEl);
    bar();
  }

  // The login is not checked by a server (there is none). The password unlocks the
  // GitHub access key kept, locked, in admin/access.json (made by tools/make_login.mjs).
  function unlock(login, password) {
    function bytes(s) { var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
    return fetch("access.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw friendly("The login has not been set up yet. Ask Jeevesh.");
      return r.json();
    }).then(function (a) {
      var enc = new TextEncoder();
      return crypto.subtle.importKey("raw", enc.encode(login.trim().toLowerCase() + "\n" + password.trim()), "PBKDF2", false, ["deriveKey"]).then(function (material) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: bytes(a.salt), iterations: a.iterations }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      }).then(function (key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(a.iv) }, key, bytes(a.data));
      }).then(function (plain) { return new TextDecoder().decode(plain); }, function () {
        throw friendly("That login or password is not right. Check the spelling and try again.");
      });
    });
  }

  function renderSignIn(message) {
    var login = h("input", { type: "text", autocomplete: "username", autocapitalize: "none", "aria-label": "Login", placeholder: "Login" });
    var password = h("input", { type: "password", autocomplete: "current-password", "aria-label": "Password", placeholder: "Password" });
    var msg = h("p", { class: "status bad", role: "alert", hidden: !message, text: message || "" });
    var btn = h("button", { type: "submit", class: "btn primary" }, "Open the dashboard");
    app.replaceChildren(h("main", { class: "signin" },
      h("img", { src: SITE + "assets/img/logo.png", alt: "Bristol Hotel Salalah", width: 499, height: 136 }),
      h("h1", { text: "Website dashboard" }),
      h("p", { text: "Change the room and breakfast prices and the photos on the hotel's website." }),
      h("form", { onsubmit: function (e) {
        e.preventDefault();
        if (!login.value.trim() || !password.value.trim()) return;
        btn.disabled = true;
        btn.textContent = "Checking…";
        unlock(login.value, password.value).then(start).catch(function (err) {
          S.token = null;
          renderSignIn(err.status === 401 ? "The login is right, but the access key behind it has expired. Please tell Jeevesh." : explain(err));
        });
      } }, msg, login, password, btn),
      h("p", { class: "hint", text: "You stay signed in on this device. Use “Sign out” on a shared phone or computer." })));
  }

  function signOut() {
    if (dirty() && !confirmDiscard()) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
    S.token = S.draft = S.saved = null;
    S.photos.clear();
    renderSignIn();
  }

  function start(key) {
    S.token = key;
    return Promise.all([loadContent(), loadSlots()]).then(function () {
      try { localStorage.setItem(KEY, key); } catch (e) { /* private mode: stay signed in for this visit */ }
      render();
    });
  }

  /* ---------------------------------------------------------------- boot */
  var stored = null;
  // A set-up link can carry the key after "#key=", so it never reaches a server.
  var m = /^#key=(.+)$/.exec(location.hash);
  if (m) {
    stored = decodeURIComponent(m[1]);
    history.replaceState(null, "", location.pathname + location.search);
  } else {
    try { stored = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  }
  if (stored) {
    start(stored).catch(function (err) {
      S.token = null;
      renderSignIn(err.status === 401 ? "Please sign in again." : explain(err));
    });
  } else {
    renderSignIn();
  }
})();
