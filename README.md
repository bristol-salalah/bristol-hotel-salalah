# Bristol Hotel Salalah: website

A static website (HTML, CSS and a little JavaScript) for **Bristol Hotel Salalah**, a 3-star hotel on As Saadah Street in Salalah, Oman.
English (`/`) and Arabic (`/ar/`, right to left) are written by hand. Seven more languages are generated from the English page by a small build script (see **Languages**): Hindi (`/hi/`), German (`/de/`), Russian (`/ru/`), French (`/fr/`), Italian (`/it/`), Polish (`/pl/`) and Simplified Chinese (`/zh/`).
There is no server code and no database. Bookings go straight to WhatsApp (+968 9726 0111) with a pre-filled message.

## Files

```
index.html            English home page (the source for the generated languages)
ar/index.html         Arabic home page (right to left, hand-written)
hi/ de/ ru/ fr/ it/ pl/ zh/   Generated language pages (don't edit; run the build)
data/i18n/            Translation catalogs, one JSON per language (+ _source.json, written by the build)
tools/                build.py, i18n.py, check_i18n.py (Python 3, nothing to install)
404.html              "Page not found" page
assets/css/style.css  All styles (colours and fonts are set at the top in :root)
assets/css/fonts.css  Self-hosted fonts (no Google requests), incl. Latin-extended and Cyrillic subsets
assets/js/main.js     WhatsApp booking form, language menu, mobile menu, animations
assets/img/           favicon.svg, apple-touch-icon.png (the hotel's own B logo), og-image.jpg, map.svg, pattern.svg
assets/img/photos/    Hotel photos, recompressed (originals from the hotel's listing photos)
robots.txt, sitemap.xml, .nojekyll
```

## Languages

Why these seven: the Khareef crowd is Omani and GCC (Arabic), then visitors from India and the subcontinent (Hindi), with Europeans in the winter season (German, Russian, French, Italian, Polish) and a growing number from China.

**After changing the English page**, run `python3 tools/build.py`. It rewrites the language menu, the `hreflang` links and `sitemap.xml` in every page, regenerates `data/i18n/_source.json` (every English string), and rebuilds the seven generated pages. New or changed text shows in English on those pages until you add it to `data/i18n/<code>.json`; `python3 tools/check_i18n.py` lists what is missing and fails if a translation adds or drops a placeholder.

Strings hide numbers and HTML behind placeholders, so a translation can't change a price or break a link: `<strong>$32</strong> / night` becomes `<0>${0}</0> / night`. Keep every `{0}`, `<0>…</0>` and `<0/>`. The Arabic page is still edited by hand.

The WhatsApp message a guest sends is in English on every page except the Arabic one, so the front desk can always read it. Hindi and Chinese pages use the device's own fonts for those scripts; Polish and Russian use the same Manrope and Cormorant Garamond as English (Latin-extended and Cyrillic subsets are included).

The translations were machine-made, including the guest quotes. Ask a native speaker to read through each language when you can.

## Preview locally

Open `index.html` in a browser. To test the way it will run online, start a local web server:

```
python3 -m http.server 8000   # then open http://localhost:8000
```

## Publish (GitHub Pages, free)

The repository is published at **https://jeeveshverma.github.io/bristol-hotel-salalah/** (Settings → Pages → Deploy from branch → `main` / root). Language pages live at `/ar/`, `/hi/`, `/de/`, `/ru/`, `/fr/`, `/it/`, `/pl/` and `/zh/`.

To put it on the hotel's own domain (`bristolhotelsalalah.com`, currently a GoDaddy placeholder page):
under Settings → Pages → Custom domain, add `www.bristolhotelsalalah.com`, then point the domain's DNS at GitHub Pages:
four A records (185.199.108.153, .109.153, .110.153, .111.153) plus a `www` CNAME to `jeeveshverma.github.io`.

Netlify and Cloudflare Pages also work: drag and drop the folder.

## Where the facts came from

| Fact | Source |
|---|---|
| Name, Arabic name, phone +968 23 321666, Instagram, check-in/out, Google 4.0 (364) | Google Maps listing |
| Second phone 97260111, licence MHT L1169594, tagline "جوهرة في قلب السعادة", Laylati Hall, offers | Instagram bio and highlights (@bristol_hotel_salalah) |
| Room types, sizes, beds, prices, facilities, review score 7.9 (172), category scores, quotes, house rules, Silk Road Restaurant | Booking.com listing, 7 Oct 2026 |
| 42 rooms, opened 2019, breakfast 7:00–10:30 | Trip.com, Expedia |
| 53 rooms (conflicts with 42), 2 meeting rooms, smoke-free | topomanhotels.com |
| Coordinates 17.0526615, 54.1570177 | Google Maps / Wanderlog |
| Distances | Booking.com (airport 6–7 km, Dahariz 6 km, Al Haffa 8 km), Google (Al Baleed 8 km); Wadi Darbat and the mosque from the map |

## Before going live: confirm with the hotel

| Item | Current value on the site | Why it needs checking |
|---|---|---|
| WhatsApp number | +968 9726 0111 (`wa.me/96897260111`) | From the Instagram bio ("للإستفسار والحجز 23321666 / 97260111"). Confirm it is on WhatsApp and who answers it |
| Domain | `www.bristolhotelsalalah.com` (in canonical, og, sitemap, robots) | The hotel owns the domain (GoDaddy builder placeholder). Replace if they use another |
| Prices | Deluxe $32, Junior Suite $39, Superior Suite $42, Executive Suite $44, breakfast $5 pp | Booking.com, 8–9 Oct 2026, before taxes (about +20%). The hotel may prefer OMR |
| Number of rooms | 42 | Booking/Expedia/Trip.com say 42, topomanhotels says 53 |
| Check-in / out | 2:00–11:00 pm / before 12:00 noon | Booking.com house rules |
| Payment | "At the hotel, cash accepted; ask about card" | Booking.com lists cash only, Trip.com says cash and cards |
| Suite occupancy | "King + sofa bed", Executive "family of five" | Booking showed max 2 for a 2-adult search; bed counts suggest more |
| Events hall name | "Laylati Hall" (قاعة ليلتي) | Taken from an Instagram highlight title; confirm the name and what it hosts |
| Cancellation | "We'll explain the terms on WhatsApp" | Not published for direct bookings |
| Massage / spa prices | "charged separately" | Not published |
| Languages | Arabic & English | Reviews mention Omani, Egyptian and Indian staff |
| Accessibility | "Wheelchair accessible, accessible bathrooms" | Booking.com accessibility filters; lift not confirmed |
| Email | not shown | Add one if the hotel wants it |

## Editing

* **Prices:** search `index.html` and `ar/index.html` for `$32` / `$39` / `$42` / `$44`, update the `<option>` labels in the booking form, then run `python3 tools/build.py` (numbers are placeholders, so the other languages pick them up without a new translation).
* **WhatsApp number:** change `PHONE` in `assets/js/main.js` and the `wa.me/96897260111` links in `index.html` and `ar/index.html`, then run the build.
* **Photos:** replace files in `assets/img/photos/` with the same names. Photos are 1080 px wide; larger originals from the hotel will improve the site, especially `hero.jpg`.
* **Reviews:** verbatim quotes from verified Booking.com reviews (English page: Khalid, Prasath, Marwan; Arabic page: Asim, Mohamed, Khuwar, Rashedi) and Google (Renny J, Ophel V). Keep the attribution if you change them.
* **Arabic page:** `ar/index.html` is written by hand; keep it in step with `index.html` when you change facts. The other languages follow `index.html` automatically through the build.

Fonts: Cormorant Garamond, Manrope, Tajawal and Noto Kufi Arabic, all under the SIL Open Font License.
