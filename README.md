# Pokémon Tool

WebApp ช่วยเล่นเกมโปเกม่อน — ดูธาตุแพ้/ชนะ ค้นหาโปเกม่อน ดูข้อมูลแยกตามภาค

Static SPA: HTML + CSS + Vanilla JavaScript • ไม่มี build step

---

## ฟีเจอร์

**Battle-first (ใช้ระหว่างเล่นเกมจริง)**
- **Quick Lookup** — พิมพ์ชื่อโปเกม่อน → ดู type, weakness 4×, immune 0×, best attacks ทันที
- **Type Calculator** — เลือก type 1 + type 2 → matchup card เดียวกัน
- **Autocomplete** — พิมพ์ส่วนหนึ่ง ("char", "mr mime", "type null") + form aliases ("alolan vulpix", "mega charizard x", "wash rotom")

**My Team (Advisor)**
- **Team builder** — เพิ่มได้ 6 ตัว, persist localStorage, เปลี่ยน form ได้ทุก variant
- **Coverage analysis** — Insights, full coverage table, sort by severity / type
- **Recommended Fixes** — Critical/High/Medium gap detection + helper defensive types + Top patch badges
- **Best Patch Types** — score single types ที่ patch ทีมได้, role labels (Best all-round / Strong / Niche)
- **Suggested Pokémon** — top 3 ต่อ patch type (final-evolution filter + curated competitive picks + multi-fit badge)
- **Team Presets** — Save/Load/Rename/Delete หลายทีม + Share via URL (base64url)
- **Backup / Restore** — Export presets + current team เป็นไฟล์ JSON, Import แบบ Merge หรือ Replace (validates + auto-renames duplicates)

**Deep info**
- **Pokémon Detail** — 7 subtabs (Summary / Matchups / Stats / Evolution / Abilities / Moves / Locations) + form selector ครบทุก variant ที่ PokéAPI มี
- **Move audit** — count แยก Level-up / TM-TR-HM / Egg / Tutor ต่อภาค
- **Evolution warnings** — Wurmple, Tyrogue, Inkay, Pancham, Galarian Farfetch'd, Basculin, Primeape, Bisharp, Gimmighoul, Milcery และอื่นๆ
- **Type Chart Reference** — ตาราง 18×18 พร้อม highlight row/column
- **Natures (25 รายการ)** + **Abilities** พร้อม category filter (Weather / Damage / Stat / Status / ฯลฯ)

**Multi-gen accuracy**
- Type chart 3 era: Modern (Gen 6+, verified), Gen 2–5 (no Fairy, Steel resists Ghost/Dark), Gen 1 (best-effort, includes major bugs)
- เลือก version game → auto-map chart era + banner ระบุชัด
- ห้าม "ใช้ Modern chart เงียบๆ" เมื่อภาคที่เลือกใช้ chart อื่น

**Data source priority**
- Manual verified override → PokéAPI → No data (ไม่เดา)
- Status badge ทุกจุด: Static Verified / PokéAPI / Cached / May be incomplete / No data

---

## วิธีรัน local

ต้องเปิดผ่าน HTTP server (ไม่ใช่ `file://` ตรงๆ เพราะ JS ใช้ `fetch()` จะติด CORS)

**ตัวเลือก 1: Node**
```bash
npx http-server . -p 8765 -c-1
# เปิด http://localhost:8765
```

**ตัวเลือก 2: Python**
```bash
python -m http.server 8765
# เปิด http://localhost:8765
```

**ตัวเลือก 3: Claude Code preview**
```bash
# ดูไฟล์ .claude/launch.json
```

---

## วิธี deploy

Static hosting อะไรก็ได้ — Vercel / Netlify / GitHub Pages / Cloudflare Pages / S3+CloudFront

ไม่ต้อง build, อัพโหลดทั้งโฟลเดอร์ขึ้นได้เลย

**ตัวอย่าง Netlify:**
```bash
# Drag & drop โฟลเดอร์ลงเว็บ netlify.com/drop
# หรือ
netlify deploy --prod --dir .
```

**ตัวอย่าง GitHub Pages:**
```bash
git init && git add . && git commit -m 'init'
git remote add origin <repo-url>
git push -u origin main
# เปิดที่ repo Settings → Pages → Deploy from branch main
```

---

## โครงสร้างไฟล์

```
index.html              # entry point — Single Page App
README.md               # ไฟล์นี้
css/
  styles.css            # dark theme + battle card + autocomplete + responsive
js/
  data.js               # type chart (3 eras), natures, version groups,
                        # SPECIAL_EVO_NOTES, ABILITY_TAGS, FORM_ALIASES, LOCATION_OVERRIDES
  version.js            # global state — selected version group + era + banner
  api.js                # PokéAPI wrapper + localStorage cache (TTL 7 วัน)
  search-suggest.js     # autocomplete dropdown + species list cache (TTL 30 วัน)
  chart.js              # type chart reference matrix
  matchup-ui.js          # shared battle card (TL;DR + Use + Avoid + Defensive)
  quicklookup.js        # Quick Lookup tab
  calc.js               # Manual Type Calc tab
  detail.js             # Pokémon Detail with 7 subtabs + form selector
  natures.js            # Nature grid
  abilities.js          # Ability list, categories, search, back-nav
  app.js                # tab routing, init, era badge updater
.claude/launch.json     # dev server config สำหรับ Claude Code preview
```

---

## Data sources & status

| Data | Source | Status |
|---|---|---|
| Type chart Gen 6+ Modern | Static (Bulbapedia verified) | ✅ Verified |
| Type chart Gen 2–5 | Static (derived from modern) | ✅ Verified |
| Type chart Gen 1 | Static (major bug-fixes included) | ⚠ Best-effort approximation |
| Nature table (25) | Static | ✅ Verified |
| Pokémon stats / types / abilities | PokéAPI `/pokemon/{name}` | ✅ Live |
| Pokémon forms (variants) | PokéAPI `/pokemon-species/{name}` `.varieties[]` | ✅ Live |
| Evolution chain | PokéAPI `/evolution-chain/{id}` | ⚠ Some conditions incomplete — see SPECIAL_EVO_NOTES |
| Moves per version | PokéAPI `.moves[].version_group_details` | ✅ Filtered by `version_group.name` |
| Egg moves Gen 8+ | PokéAPI | ⚠ Often missing in SwSh / BDSP |
| Locations | PokéAPI `/pokemon/{id}/encounters` | ⚠ Sparse for new games (SV) and oldest (RBY) |
| Abilities list + Pokemon using each | PokéAPI `/ability/{name}` | ✅ Live |
| Ability category tags | Static (hand-curated ~70 / ~300+) | ⚠ Partial coverage; use "Untagged" chip or All search |
| Form aliases ("alolan vulpix") | Static (~85 aliases) | ✅ Covers Gen 7–9 regional, mega, gmax, primal |

---

## Known limitations

1. **Gen 1 chart** มี TODO comment — edge case บางอย่างยังไม่ verify ครบทุก cell
2. **PokéAPI egg moves ใน SwSh/BDSP** มักขึ้น 0 (API ใช้ field อื่นเก็บ) — ตรวจจาก Bulbapedia แทน
3. **LOCATION_OVERRIDES** ยังว่าง — architecture พร้อม แต่ไม่มี manual entry
4. **ABILITY_TAGS** ครอบคลุม ~70 / ~300+ — abilities อื่นใช้ Search keyword หรือชิป "Untagged"
5. **Autocomplete** ใช้ species list — form variant ค้นจาก `FORM_ALIASES` (มีหลัก 85 รายการ) หรือพิมพ์ตรง ("vulpix-alola")
6. **localStorage cache** TTL 7 วัน — clear browser data ถ้าโปเกม่อนใหม่ออกแล้วยังไม่อัพเดต
7. **Offline**: matchup calc + type chart + natures + form aliases ทำงานได้ทั้งหมด — Quick Lookup / Detail ต้องการ network ครั้งแรก (จากนั้น cache)

---

## License / Credits

- Pokémon data: [PokéAPI](https://pokeapi.co/)
- Type chart reference: [Bulbapedia — Type Chart](https://bulbapedia.bulbagarden.net/wiki/Type)
- Sprites: PokéAPI Sprites GitHub repo

Pokémon ™ © Nintendo / Game Freak / Creatures Inc. — ใช้ส่วนตัวเท่านั้น
