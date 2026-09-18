# OneBook ELD — Web panel texnik topshirig'i

**Versiya:** 1.0 — back-office web ilovasi · 4 rol · 108 ta dizayn ekranidan chiqarilgan
**Stack:** React 19 · TypeScript 5 · Vite 6 · TanStack Query 5 · React Router 7 · Tailwind CSS 4 · Socket.IO client · MapLibre GL
**Backend:** NestJS 11 API — `backend/tz.md` v3.1 va `backend/src/` dagi **amaldagi kod**
**Mo'ljal:** AQSh va Kanada bozori · FMCSA 49 CFR Part 395

---

## Mundarija

| # | Bo'lim | Nima haqida |
|---|---|---|
| **0** | **Bu hujjat haqida** | ⭐ **Buyurtmachi qarorlari Q-1…Q-3**, manbalar, ustuvorlik tartibi |
| 1 | Mahsulot va qamrov | Nima quriladi, nima qurilmaydi, 4 rol, hajm |
| 2 | Stack va arxitektura | Texnologiyalar, papka tuzilishi, muhitlar, CI |
| 3 | Dizayn tizimi | Ranglar, tipografika, o'lchamlar, ikonkalar |
| 4 | Global layout | Sidebar, topbar, rol chipi, Settings navigatsiyasi |
| 5 | Umumiy komponentlar | Button, Badge, KpiCard, DataTable, Modal, holatlar |
| **6** | **API qatlami** | Envelope, kesh, **auth rejimlari (dev/prod)**, **demo akkauntlar**, **drayver akkauntlari**, ruxsat modeli |
| 7 | Real-time | Socket.IO, xonalar, mavjud va yetishmayotgan hodisalar |
| 8 | Formatlash | Birliklar, vaqt, **vaqt mintaqasi qoidalari** |
| 9 | Route jadvali | Barcha URL'lar va guardlar |
| **10** | **Ekranlar (W-00 … W-26)** | **Har bir ekranning to'liq spetsifikatsiyasi** |
| **11** | **Modallar katalogi (11.1 … 11.30)** | **30 ta overlay** |
| 12 | Rol matritsasi | Ekran ko'rinishi, read-only qoidalari |
| 13 | Holatlar va xabarlar | Empty/loading/error matnlari, toastlar |
| 14 | Formalar va validatsiya | Maydon qoidalari, xato kodlari |
| 15 | Accessibility | WCAG 2.1 AA talablari |
| 16 | Performance | Bundle budjeti, runtime maqsadlari |
| 17 | Xavfsizlik | CSP, token, PII |
| 18 | Testlash | Qamrov, E2E ssenariylari |
| 19 | Bosqichlar | 10 bosqich |
| **20** | **Backend gap'lari** | **24 ta talab — ularsiz ekranlar chiqmaydi** |
| 21 | Nomuvofiqliklar | Dizayn ↔ TZ ↔ buyurtmachi, **9 ta qaror** |
| 22 | Qabul mezonlari | 15 band |
| 23 | Ochiq savollar | 7 ta |

---

## 0. Bu hujjat haqida

Bu TZ **web panel uchun yagona haqiqat manbai**. Ziddiyat bo'lsa tartib shunday:

**FMCSA 49 CFR §395 > `web/roles and screens/` skrinshotlari > `backend/src/` amaldagi API > `backend/tz.md` > bu hujjat**

> ⚠️ **Eng muhim qoida:** `web/roles and screens/` papkasidagi rasmlar — **pixel-etalon**. Har bir
> ekran shu rasmlarga **aynan** mos kelishi kerak: bir xil sarlavha matni, bir xil ustun nomlari,
> bir xil tugma yozuvlari, bir xil badge ranglari, bir xil bo'sh holat matnlari. Ixtiyoriy
> "yaxshilash" qilinmaydi. Rasmdagi matn (`Send to inspector`, `Certify all`, `Out of service`)
> **ingliz tilida, aynan shu ko'rinishda** qoladi.

### 0.1. ⭐ Buyurtmachi qarorlari (2026-09-12) — dizayndan ustun

Bu ikki qaror `web/roles and screens/` rasmlaridan ham, `backend/tz.md` dan ham **ustun
turadi**. Ular hujjat bo'ylab tegishli joylarda batafsil yozilgan.

| # | Qaror | Ta'siri | Batafsil |
|---|---|---|---|
| **Q-1** | **Prod'da kirish faqat Google (Gmail) orqali.** Hozircha (dev/staging) **haqiqiy Gmail shart emas** — seed akkauntlari email+parol bilan kiradi | Ikki auth rejimi: `dev` va `production`. Sign-in sahifasida Google tugmasi **doim**, email+parol bloki **faqat dev build'da** | **§6.6** · W-00 · §21.1 |
| **Q-2** | **SMS umuman ishlatilmaydi** — hamma xabar email orqali | Alert rules'da `SMS` kanali doim `disabled`; `channels` massiviga `SMS` hech qachon qo'shilmaydi; drayver taklifnomalari email orqali | W-21 · 11.7 · 11.8 · 11.21 · §21.5 |
| **Q-4** | **2026-09-13: ikki bosqichli autentifikatsiya (2FA/TOTP) butunlay olib tashlandi** — hech bir rol, hech bir rejimda | `/sign-in/2fa`, W-00b, 2FA sozlash/o'chirish, `Reset two-factor`, `Require two-factor authentication`, `TWO_FACTOR_*` kodlari yo'q; `POST /auth/login` va `POST /auth/google` doim token juftligini qaytaradi (`web/decisions.md` WD-067) | §6.5 · §6.6 · W-26 · W-18 · 11.18 |
| **Q-3** | **Har bir rol uchun bittadan demo akkaunt**; qolgan barcha foydalanuvchi va **drayverlarni admin (yoki `drivers: FULL` huquqiga ega rol) web orqali yaratadi** | Seed 4 ta kanonik akkaunt beradi (§6.7). Drayverga **Gmail manzili web'dan beriladi** va u shu manzil bilan kiradi; prod'da manzil **tasdiqlanadi** | §6.7 · §6.8 · W-06 · 11.8 |

**O'zgarmaydigan narsalar:** taklifnomasiz kirish yo'q; drayver **web panelga hech qachon kirmaydi** — u faqat
mobil ilovada ishlaydi.

### 0.2. Manba materiallar

| Manba | Joyi | Nima beradi |
|---|---|---|
| Admin panel ekranlari | `web/roles and screens/admin panel/` — **26 ta** | To'liq (superset) ko'rinish |
| Fleet manager ekranlari | `web/roles and screens/fleet menager/` — **21 ta** | FLEET_MANAGER kesimi |
| Dispatcher ekranlari | `web/roles and screens/dispatcher/` — **14 ta** | DISPATCHER kesimi |
| Viewer ekranlari | `web/roles and screens/viewer/` — **16 ta** | VIEWER kesimi |
| Modal / drawer / menyular | `web/roles and screens/sheets, modals, drawers, menus/` — **30 ta** | Barcha overlay'lar |
| Sign in ekrani | `.tmp_docimg/shared-login.png` | Kirish sahifasi |
| Backend TZ | `backend/tz.md` (3008 qator) | Domen qoidalari, RBAC, birliklar |
| Backend kodi | `backend/src/**` | **Amaldagi** endpointlar va javob shakllari |
| Qarorlar | `backend/decisions.md` (D-001…D-049) | Nima uchun shunday |

> ⚠️ **Modal papkasidagi fayl nomlari mazmuniga mos emas.** Masalan
> `Sign in — split brand panel with SSO.jpg` aslida **"Create a geofence"** modalini
> ko'rsatadi. Shu sababli 11-bo'limda har bir modal **mazmuni bo'yicha** katalogga olingan va
> yonida haqiqiy fayl nomi ko'rsatilgan. Fayl nomiga ishonmang — 11-bo'limga qarang.

### 0.3. Har bir ekran uchun majburiy tarkib

Bu TZ da har bir ekran quyidagi 10 band bilan yozilgan. Amalga oshiruvchi shu 10 bandni
bajarsa, ekran tayyor deb hisoblanadi:

1. **Route** — URL va query parametrlari
2. **Ruxsat** — qaysi permission key va daraja kerak
3. **Ma'lumot manbai** — aniq endpoint(lar) va query key
4. **Layout** — grid, ustunlar kengligi, kartalar tartibi
5. **Header** — sarlavha, subtitle, o'ng tomondagi amallar
6. **Bloklar** — har bir karta/jadval to'liq tarkibi
7. **Amallar** — tugma → modal → endpoint → natija
8. **Holatlar** — loading / empty / error / no-permission
9. **Real-time** — qaysi xona, qaysi hodisa, nima yangilanadi
10. **Qabul mezoni** — tekshiriladigan ro'yxat

---

## 1. Mahsulot va qamrov

### 1.1. Nima quriladi

Bitta yuk tashuvchi kompaniya (Universal Logistics Inc., DOT #1234567, 69 unit, 58 drayver,
12 back-office foydalanuvchi) uchun **back-office web paneli**.

| Kirmaydi | Sabab |
|---|---|
| Drayver interfeysi | Mobil ilova (Flutter) — alohida TZ |
| Planshet interfeysi | Mobil ilova landshaft rejimi |
| Billing / obuna ekranlari | `backend/tz.md` §1.4 — mahsulot sotilmaydi. Dizaynda `Settings — plan, usage, payment, invoices.jpg` fayl nomi bor, lekin **uning ichida boshqa modal** (Register an ELD device) chizilgan — ya'ni billing ekrani aslida chizilmagan ham. **Qurilmaydi** |
| Multi-tenant / org switcher | Bitta carrier. Dizayndagi `Switch organisation` punkti **disabled** holatda ko'rsatiladi (12.6-bo'lim) |
| Terminal bo'yicha scoping | `backend/tz.md` §26 — hozircha bitta baza. `Terminal` filtri UI da bor, lekin faqat **filtr**, xavfsizlik chegarasi emas |
| **Email + parol bilan kirish** | Q-1 qarori — web'da faqat Google. Backend endpointi qoladi, web chaqirmaydi |
| **SMS bildirishnomalar** | Q-2 qarori — hamma xabar email orqali |

### 1.2. Rollar

| Rol | Kim | Ekranlar soni | Avatar (seed) |
|---|---|---|---|
| `ADMIN` | Sarah Chen — Safety Director | **26** | `SC` |
| `FLEET_MANAGER` | Mike Rowan | **21** | `MR` |
| `DISPATCHER` | Dana Ford | **14** | `DF` |
| `VIEWER` | Priya Nair | **16** | `PN` |

### 1.3. Hajm va yuk

| Ko'rsatkich | Bugun | 2 yil ichida |
|---|---|---|
| Bir vaqtdagi web foydalanuvchi | 12 | 40 |
| Live Fleet jadvalidagi unit | 69 | 300 |
| Drivers jadvalidagi qator | 58 | 250 |
| Audit log jadvalidagi qator | 1 204 | ~50 000 |
| WebSocket ulanish | 12 | 40 |

Bu raqamlar **virtualizatsiya kerak emasligini** bildiradi (300 qator — oddiy DOM).
Faqat `Audit log` va `Log events` uchun serverdan pagination olinadi.
---

## 2. Stack va arxitektura

### 2.1. Tanlangan stack

| Qatlam | Tanlov | Nega |
|---|---|---|
| Build | **Vite 6** | Backend NestJS bilan bir xil Node 24; SSR kerak emas (ichki panel, SEO yo'q) |
| Til | **TypeScript 5** (`strict: true`) | Backend bilan bir xil |
| UI | **React 19** | `useOptimistic`, `useActionState` — jadval amallari uchun |
| Routing | **React Router 7** (data router, `createBrowserRouter`) | Loader/action emas — TanStack Query bilan ishlaymiz, faqat routing va guard |
| Server state | **TanStack Query 5** | Kesh, refetch, invalidation, optimistic update |
| Client state | **Zustand** | Faqat UI holati: sidebar collapse, table settings, saved views, toast navbati |
| Form | **react-hook-form + zod** | Backend DTO'lari ham zod — sxemalar bir xil uslubda |
| Stil | **Tailwind CSS 4** + CSS o'zgaruvchilar (dizayn tokenlari) | 3-bo'limdagi tokenlar `@theme` orqali |
| Komponent primitivlari | **Radix UI** (Dialog, Popover, DropdownMenu, Tabs, Checkbox, Switch, Tooltip, Toast) | A11y tekin keladi; ko'rinish 100% o'zimizniki |
| Jadval | **TanStack Table 8** (headless) | Ustun ko'rinishi/tartibi (`Table settings` modali) shu bilan |
| Grafik | **Recharts** — donut, bar; **24-soatlik grid — o'z SVG komponentimiz** | Grid FMCSA formati, hech bir kutubxona bermaydi |
| Xarita | **MapLibre GL JS** + vektor tile provayder (env orqali) | Litsenziyasiz, Google'ga bog'lanmaydi |
| WebSocket | **socket.io-client 4** | Backend `@nestjs/platform-socket.io` |
| Sana | **date-fns** + **date-fns-tz** | Backend ham `Intl` asosida ishlaydi (D-015) |
| Test | **Vitest** + **Testing Library** + **MSW** + **Playwright** | Birlik/komponent + kontrakt + E2E |
| Lint | ESLint 9 flat config + Prettier — **backend `.prettierrc` bilan bir xil** | Bitta repo, bitta uslub |

**Taqiqlanadi:** Next.js (SSR keraksiz), Material UI / Ant Design (dizayn 100% o'zimizniki),
Redux Toolkit (server state TanStack Query'da), moment.js, jQuery, Google Maps SDK.

### 2.2. Papka tuzilishi

```
web/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── .env.example
├── public/
└── src/
    ├── main.tsx                     # entry, providers
    ├── app/
    │   ├── router.tsx               # barcha route'lar + guardlar
    │   ├── providers.tsx            # QueryClient, Auth, Realtime, Toast, Theme
    │   └── layouts/
    │       ├── AppShell.tsx         # sidebar + topbar + outlet
    │       ├── SettingsLayout.tsx   # Settings ikkinchi darajali nav
    │       ├── AccountLayout.tsx    # My account ikkinchi darajali nav
    │       └── AuthLayout.tsx       # split brand panel
    ├── shared/
    │   ├── api/
    │   │   ├── client.ts            # fetch wrapper, envelope, xatolar
    │   │   ├── endpoints.ts         # ⭐ BARCHA URL'lar shu yerda, string literal boshqa joyda yo'q
    │   │   ├── queryKeys.ts         # ⭐ query key fabrikasi
    │   │   ├── types.ts             # backend DTO tiplari (openapi'dan generatsiya)
    │   │   └── errors.ts            # ErrorCode → foydalanuvchi matni
    │   ├── auth/
    │   │   ├── AuthProvider.tsx     # token, refresh, /auth/me, idle
    │   │   ├── usePermission.ts     # ⭐ can('vehicles','FULL')
    │   │   ├── Can.tsx              # <Can perm="vehicles" level="FULL">
    │   │   └── permissions.ts       # 22 kalit, rol matritsasi
    │   ├── realtime/
    │   │   ├── RealtimeProvider.tsx # socket ulanish, reconnect, resync
    │   │   ├── useRoom.ts           # xonaga obuna (mount/unmount)
    │   │   └── events.ts            # hodisa nomlari + payload tiplari
    │   ├── ui/                      # dizayn tizimi (4-bo'lim)
    │   │   ├── Button.tsx  Badge.tsx  Card.tsx  KpiCard.tsx
    │   │   ├── DataTable.tsx  Pagination.tsx  TableSettings.tsx
    │   │   ├── Modal.tsx  Drawer.tsx  ConfirmDelete.tsx
    │   │   ├── EmptyState.tsx  LoadingState.tsx  ErrorState.tsx
    │   │   ├── Toast.tsx  OfflineBanner.tsx  ProgressCard.tsx
    │   │   ├── HosMeter.tsx  DutyBadge.tsx  SeverityBadge.tsx
    │   │   ├── DateRangePicker.tsx  DriverPicker.tsx  UnitPicker.tsx
    │   │   └── Avatar.tsx  FilterDrawer.tsx  SectionHeader.tsx
    │   ├── format/                  # ⭐ mi, gal, mph, HH:MM, sana, timezone
    │   └── hooks/
    └── features/                    # ekran bo'yicha
        ├── auth/            dashboard/     live-fleet/
        ├── vehicles/        drivers/       trips/
        ├── hos-logs/        dvir/          safety/
        ├── reports/         messages/      notifications/
        ├── settings/        account/       support/
        └── search/                          # command palette
```

**Qat'iy qoidalar:**

1. `features/*` bir-birini **import qilmaydi**. Umumiy narsa `shared/` ga chiqadi.
2. URL string faqat `shared/api/endpoints.ts` da. Komponentda `fetch('/api/...')` — **lint xatosi**.
3. Query key faqat `shared/api/queryKeys.ts` fabrikasidan. Qo'lda massiv yozilmaydi.
4. Ranglar/o'lchamlar faqat token orqali. `#2563EB` yozilishi — **lint xatosi** (`no-hex-colors`).
5. Har bir `features/*` papkasida `README.md` — qaysi dizayn faylidan olingani (`web/roles and screens/...`).

### 2.3. Muhitlar

| | Dev | Prod |
|---|---|---|
| Web port | `5173` | statik fayl (Caddy) |
| API base | `http://localhost:3001/api/v1` | `https://<host>/api/v1` |
| **Auth rejimi** | **`dev`** — Google **va** email+parol | **`production`** — faqat Google |
| WS URL | `http://localhost:3001/realtime` | `wss://<host>/realtime` |
| Env fayl | `.env.development` | `.env.production` |

```
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_URL=http://localhost:3001
VITE_WS_NAMESPACE=/realtime
VITE_MAP_STYLE_URL=https://<tile-provider>/style.json
VITE_MAP_API_KEY=
VITE_AUTH_MODE=dev              # ⭐ dev | production  (§6.6)
VITE_FIREBASE_API_KEY=          # prod'da MAJBURIY, dev'da ixtiyoriy
VITE_FIREBASE_AUTH_DOMAIN=      # prod'da MAJBURIY
VITE_FIREBASE_PROJECT_ID=       # prod'da MAJBURIY
VITE_SENTRY_DSN=
VITE_APP_VERSION=          # CI to'ldiradi (git sha)
```

> **CORS:** backend `CORS_ORIGINS` ro'yxatiga web origin qo'shilishi shart, aks holda ham REST
> ham WebSocket bloklanadi (`realtime.gateway.ts` shu o'zgaruvchini o'qiydi).

### 2.4. Build va CI

`.github/workflows/ci.yml` ga **`web` job** qo'shiladi (backend job'dan mustaqil):

```
npm ci → npm run typecheck → npm run lint → npm run test:unit
       → npm run test:contract   (MSW + openapi.json)
       → npm run build           (bundle budjeti tekshiriladi — 16.1)
       → npx playwright test      (E2E, seed qilingan dev DB ga qarshi)
```

**Darvoza:** typecheck 0 xato · lint 0 warning · unit qamrov ≥ 80% · `shared/format` va
`shared/auth/permissions.ts` uchun **100%** · E2E smoke to'liq yashil · bundle budjeti oshmagan.
---

## 3. Dizayn tizimi — tokenlar

Barcha qiymatlar `web/roles and screens/` rasmlaridan olingan. Har bir token CSS
o'zgaruvchisi sifatida `:root` da e'lon qilinadi va Tailwind `@theme` ga ulanadi.

### 3.1. Ranglar

```css
:root {
  /* Sirtlar */
  --bg-app:        #F7F9FC;   /* sahifa foni */
  --bg-surface:    #FFFFFF;   /* karta, jadval, modal */
  --bg-sidebar:    #FFFFFF;
  --bg-subtle:     #F1F5F9;   /* jadval header hover, skeleton */
  --bg-nav-active: #EFF4FF;   /* sidebar faol punkt */
  --bg-overlay:    rgba(15, 23, 42, .45);  /* modal orqa fon */
  --bg-inverse:    #0F172A;   /* offline banner, bulk action bar, sign-in chap panel */

  /* Chegara */
  --border:        #E7ECF3;
  --border-strong: #CBD5E1;   /* input focus oldidan */
  --border-focus:  #2563EB;

  /* Matn */
  --text:          #0F172A;
  --text-secondary:#475569;
  --text-muted:    #94A3B8;   /* subtitle, "Unassigned", disabled */
  --text-inverse:  #FFFFFF;

  /* Brend */
  --primary:        #2563EB;
  --primary-hover:  #1D4ED8;
  --primary-active: #1E40AF;
  --primary-soft:   #EFF4FF;

  /* Semantik */
  --success:      #16A34A;  --success-soft: #ECFDF3;
  --warning:      #F59E0B;  --warning-soft: #FFFAEB;
  --danger:       #EF4444;  --danger-soft:  #FEF2F2;
  --info:         #2563EB;  --info-soft:    #EFF4FF;
  --violet:       #7C3AED;  --violet-soft:  #F5F3FF;   /* Sleeper berth */
  --neutral:      #94A3B8;  --neutral-soft: #F1F5F9;   /* Off-duty */
}
```

**Duty status ranglari — butun ilova bo'ylab bir xil (dizaynda ham shunday):**

| Status | Nuqta / chiziq | Badge foni | Badge matni | Ishlatiladi |
|---|---|---|---|---|
| `Driving` | `--success` | `--success-soft` | `--success` | Grid D chizig'i, jadval badge, donut |
| `On-duty` | `--danger` | `--danger-soft` | `--danger` | ON chizig'i, "On-duty (not driving)" |
| `Sleeper` | `--violet` | `--violet-soft` | `--violet` | SB chizig'i |
| `Off-duty` | `--neutral` | `--neutral-soft` | `--text-secondary` | OFF chizig'i |
| `Yard move` | `--danger` (nuqta) | `--danger-soft` | `--danger` | ON ostida |
| `Personal` | `--neutral` | `--neutral-soft` | `--text-secondary` | OFF ostida |
| `ELD offline` | `--danger` | `--danger-soft` | `--danger` | Faqat unit statusi |
| `Idle` | `--warning` | `--warning-soft` | `--warning` | Faqat unit statusi |
| `Inactive` | `--neutral` | `--neutral-soft` | `--text-secondary` | Faqat unit statusi |

**Severity ranglari:** `Critical` → danger · `Major` → warning · `Minor` → neutral ·
`Violation` → danger · `Warning` → warning · `Info` → info.

### 3.2. Tipografika

Shrift: **Inter** (variable), fallback `-apple-system, "Segoe UI", Roboto, sans-serif`.
Raqamlar uchun `font-variant-numeric: tabular-nums` — **barcha jadval raqamlarida,
soatlarda va odometrda majburiy** (aks holda ustunlar sakraydi).

| Token | Size / LH / Weight | Qayerda |
|---|---|---|
| `--fs-page-title` | 22 / 28 / 600 | `Fleet Dashboard`, `Unit #101` |
| `--fs-page-sub` | 13 / 18 / 400, `--text-muted` | `Universal Logistics Inc. · Today, Sep 10 2025 · ET` |
| `--fs-card-title` | 15 / 20 / 600 | `Live fleet`, `Unit details` |
| `--fs-card-sub` | 12 / 16 / 400, `--text-muted` | `28 moving · 9 idle · 32 ELD offline` |
| `--fs-kpi` | 30 / 36 / 600 | `62`, `12h 40m` |
| `--fs-kpi-label` | 13 / 18 / 500, `--text-secondary` | `Active vehicles` |
| `--fs-body` | 14 / 20 / 400 | Jadval katakchasi, forma qiymati |
| `--fs-body-strong` | 14 / 20 / 600 | `Unit #101`, drayver ismi |
| `--fs-label` | 13 / 18 / 500 | Forma yorlig'i |
| `--fs-table-head` | 11 / 16 / 600, `letter-spacing: .06em`, UPPERCASE, `--text-muted` | `UNIT #`, `DRIVE LEFT · 11H` |
| `--fs-badge` | 12 / 16 / 500 | Barcha pill'lar |
| `--fs-nav-section` | 11 / 16 / 600, `.06em`, UPPERCASE, `--text-muted` | `OPERATIONS` |
| `--fs-caption` | 12 / 16 / 400, `--text-muted` | `ECU 981,109 + offset 12,480` |

### 3.3. O'lcham va masofa

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-8: 32px;

--radius-sm: 6px;    /* badge, kichik tugma */
--radius-md: 8px;    /* input, tugma, select */
--radius-lg: 12px;   /* karta, jadval konteyneri, modal */
--radius-xl: 16px;   /* modal (katta), sign-in karta */
--radius-full: 999px;

--shadow-card:  0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06);
--shadow-pop:   0 8px 24px rgba(15,23,42,.12);   /* dropdown, popover, unit card */
--shadow-modal: 0 24px 64px rgba(15,23,42,.22);
```

| O'lchov | Qiymat |
|---|---|
| Sidebar kengligi | **212 px** (yig'ilgan holat 64 px, faqat ikonka) |
| Settings/Account ikkinchi nav | **204 px** |
| Topbar balandligi | **62 px**, pastida 1px `--border` |
| Sahifa padding | `24px` (X va Y) |
| Karta padding | `20px` |
| Kartalar orasi (gap) | `16px` |
| KPI qatori | 4 ta teng ustun, gap `16px` |
| Asosiy kontent gridi | `1fr 380px` (o'ng panel bo'lsa), gap `16px` |
| Jadval qator balandligi | **48 px** (avatar bilan **54 px**) |
| Jadval header balandligi | 40 px |
| Tugma balandligi | 36 px (asosiy), 32 px (kichik/segment) |
| Input balandligi | 40 px |
| Ikonka | 16 px (jadval, tugma), 18 px (sidebar), 20 px (KPI) |
| Avatar | 28 px (jadval), 32 px (topbar), 40 px (profil karta), 56 px (drayver sahifasi) |

### 3.4. Ikonkalar

**Lucide React** — dizayndagi ikonkalar aynan shu to'plamdan: `LayoutGrid` (Dashboard),
`MapPin` (Live Fleet), `Truck` (Vehicles), `Users` (Drivers), `Route`/`Shuffle` (Dispatch),
`Clock` (HOS Logs), `Wrench` (DVIR), `ShieldCheck` (Safety), `FileText` (Reports),
`MessageSquare` (Messages), `Settings` (Settings), `Bell`, `RefreshCw`, `Search`,
`Download`, `Upload`, `Filter`, `Plus`, `Pencil`, `Trash2`, `Send`, `Play`, `Calendar`,
`ChevronRight`, `MoreHorizontal`, `AlertTriangle`, `CheckCircle2`, `Eye`, `Minus`.

Stroke width **1.75**, rang meros (`currentColor`).

### 3.5. Holat ko'rsatkichlari (progress bar)

Dizaynda ikki xil ishlatilgan:

| Tur | Balandlik | Radius | Rang qoidasi |
|---|---|---|---|
| HOS meter (Drivers jadvali, Available hours) | 4 px | full | `> 25%` → success · `10–25%` → warning · `< 10%` yoki `0` → danger |
| Maintenance due | 6 px | full | `Due in > 30 d` yoki `> 3000 mi` → success · yaqin → warning · o'tgan → danger |

Trek rangi doim `--bg-subtle`.
---

## 4. Global layout — AppShell

Barcha ichki ekranlar bir xil qobiqda. Rasm: har bir skrinshot.

```
┌────────────┬──────────────────────────────────────────────────────────┐
│  BRAND     │  TOPBAR (62px)                                           │
│  212px     ├──────────────────────────────────────────────────────────┤
│            │                                                          │
│  NAV       │  PAGE CONTENT  (padding 24px, bg --bg-app)               │
│            │                                                          │
│  ORG CARD  │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

### 4.1. Brand bloki (sidebar tepasi)

- 40×40 `--radius-md` ko'k plitka, ichida oq `Truck` ikonkasi
- Ustki qator: **`OneBook ELD`** — 15/600
- Ostki qator: **`Fleet Manager`** — 12/400 `--text-muted` (⚠️ bu **mahsulot subtitle'i**, foydalanuvchi roli emas — barcha rollarda bir xil turadi, dizaynda ham shunday)
- O'ngda `ChevronDown` — organisation switcher; **v1 da bosilganda disabled dropdown**: `Universal Logistics Inc. ✓` + `Switch organisation — v2`

### 4.2. Navigatsiya

Punkt: 36 px balandlik, `--radius-md`, ikonka 18 px + yorliq 14/500, chapdan 12 px padding.
Faol: fon `--bg-nav-active`, matn+ikonka `--primary`, **chap chekkada 2px ko'k indikator yo'q** (dizaynda faqat fon).
Hover: fon `--bg-subtle`.
Badge: o'ng chekkada, `--radius-full`, `--danger-soft`/`--danger` (Safety `6`) yoki `--primary-soft`/`--primary` (Messages `3`).

**To'liq daraxt (ADMIN) va rol bo'yicha ko'rinish:**

| # | Yorliq | Route | Perm | ADMIN | FM | DISPATCHER | VIEWER |
|---|---|---|---|:--:|:--:|:--:|:--:|
| — | *(seksiyasiz)* `Dashboard` | `/` | `dashboard` | ✅ | ✅ | ✅ | ✅ |
| — | `Live Fleet` | `/live-fleet` | `liveFleet` | ✅ | ✅ | ✅ | ✅ |
| **OPERATIONS** | | | | | | | |
| 1 | `Vehicles` | `/vehicles` | `vehicles` | ✅ | ✅ | ✅ | ✅ |
| 2 | `Drivers` | `/drivers` | `drivers` | ✅ | ✅ | ✅ | ✅ |
| 3 | `Dispatch & Trips` | `/trips` | `trips` | ✅ | ✅ | ✅ | ❌ |
| **COMPLIANCE** | | | | | | | |
| 4 | `HOS Logs` | `/hos-logs` | `hos` | ✅ | ✅ | ✅ | ✅ |
| 5 | `DVIR & Maintenance` | `/dvir` | `dvir` | ✅ | ✅ | ❌ | ✅ |
| 6 | `Safety` `6` | `/safety` | `safety` | ✅ | ✅ | ❌ | ✅ |
| **INSIGHTS** | | | | | | | |
| 7 | `Reports` | `/reports` | `reports` | ✅ | ✅ | ✅ | ✅ |
| 8 | `Messages` `3` | `/messages` | `messaging` | ✅ | ✅ | ✅ | ❌ |
| 9 | `Settings` | `/settings` | *(quyida)* | ✅ | ✅ | ✅ | ✅ |

> ⚠️ **Dispatcher'da `DVIR & Maintenance` va `Safety` yo'q**, garchi `backend/tz.md` §6.4
> matritsasi ularga `READ` bersa ham. **Dizayn ustun** (0-bo'lim tartibi). Menyu punkti
> ko'rsatilmaydi; route'ga to'g'ridan-to'g'ri kirilsa `403` sahifasi. Backend hech narsa
> o'zgartirmaydi — `READ` qolaveradi (kelajakda ochish uchun).
>
> ⚠️ **Viewer'da `Dispatch & Trips` va `Messages` yo'q** — matritsa bilan mos (`NONE`).

`Settings` punkti **har doim ko'rinadi**, chunki har bir rolda kamida `Support` bo'limi bor.

### 4.3. Organisation karta (sidebar pastki qismi)

Doim ko'rinadi, `--border` bilan yuqoridan ajratilgan, 12 px padding:
32 px qora doira `UL` + `Universal Logistics` (13/600) + `DOT #1234567 · 69 units` (11/400 muted).
Bosilganda — hech narsa (v1 da statik).

### 4.4. Topbar

**Chap tomon:**
- Sahifa sarlavhasi (`--fs-page-title`) — 5-bo'limda har bir ekran uchun aniq matn
- Ostida subtitle (`--fs-page-sub`)
- Detal sahifalarida subtitle o'rniga **breadcrumb**: `Vehicles › Unit #101 · Freightliner Cascadia 2021` (oxirgi element `--text-secondary`, oldingilari `--primary` link)

**Sarlavha yonidagi rol chipi** (⚠️ muhim, dizaynda aniq):

| Rol | Chip | Ko'rinishi |
|---|---|---|
| `ADMIN` | **yo'q** | Chip ko'rsatilmaydi |
| `FLEET_MANAGER` | `● Fleet manager` | `--primary-soft` fon, `--primary` matn+nuqta |
| `DISPATCHER` | `● Dispatcher` | `--success-soft` fon, `--success` matn+nuqta |
| `VIEWER` | `● Read-only · Viewer` | `--neutral-soft` fon, `--text-secondary` matn |

**O'ng tomon (chapdan o'ngga):**
1. **Kontekst filtri** — faqat ba'zi ekranlarda: `Today ▾` (Dashboard), `All vehicle groups ▾` (Live Fleet). Boshqa ekranlarda yo'q.
2. **Global qidiruv** — 220 px input, `Search vehicles, drivers…`, `⌘K` bosilganda **Command palette** ochiladi (11.28)
3. **Bell** — o'ng yuqorida qizil nuqta agar o'qilmagan bor bo'lsa; bosilganda Notifications paneli (11.27)
4. **Refresh** — `RefreshCw`; bosilganda joriy ekranning barcha `useQuery` lari `invalidate` bo'ladi; aylanish animatsiyasi `isFetching` davomida
5. **Avatar + ChevronDown** — bosilganda Account menu (11.26)

### 4.5. Sahifa konteyneri

- `max-width` **yo'q** — kontent butun kenglikni egallaydi (dizaynda 1280 px da ham cheklov ko'rinmaydi)
- Minimal qo'llab-quvvatlanadigan kenglik **1280 px**. `< 1280 px` da gorizontal scroll (mobil versiya v1 da yo'q)
- `1440 px+` da KPI kartalar cho'ziladi, jadval ustunlari proporsional kengayadi

### 4.6. Ikkinchi darajali navigatsiya (Settings va My account)

`SettingsLayout` — chapda 204 px ustun, `--bg-surface` fon emas, **sahifa foni**, o'ngda kontent kartalari.
Seksiya sarlavhasi: `SETTINGS` yoki `MY ACCOUNT` (`--fs-nav-section`).

**Settings punktlari rol bo'yicha (dizayndan aynan):**

| Punkt | Route | Perm | ADMIN | FM | DISP | VIEWER |
|---|---|---|:--:|:--:|:--:|:--:|
| `Company profile` | `/settings/company` | `carrierSettings` | ✅ | ❌ | ❌ | ❌ |
| `Users` | `/settings/users` | `users` | ✅ | ❌ | ❌ | ❌ |
| `Roles & permissions` | `/settings/roles` | `roles` | ✅ | ❌ | ❌ | ❌ |
| `ELD devices` | `/settings/devices` | `devices` | ✅ | ✅ | ❌ | ❌ |
| `Alert rules` | `/settings/alerts` | `alertRules` | ✅ | ✅ | ❌ | ❌ |
| `Integrations` | `/settings/integrations` | `integrations` | ✅ | ❌ | ❌ | ❌ |
| `Audit log` | `/settings/audit` | `auditLog` | ✅ | ❌ | ❌ | ❌ |
| `Support` | `/settings/support` | `support` | ✅ | ✅ | ✅ | ✅ |

`/settings` ga kirilganda — **ro'yxatdagi birinchi ruxsat berilgan punktga** redirect
(ADMIN → `company`, FM → `devices`, DISPATCHER/VIEWER → `support`).

**My account punktlari (barcha rollarda bir xil):**
`My profile` · `Security & sign-in` · `Notifications` · `Language & region` · `Active sessions`
Pastida ajratkich va orqaga havola: `‹ Organisation settings` → `/settings`.

> Dizaynda `My profile` sahifasi bitta uzun sahifa bo'lib, ichida uchta karta (`Profile`,
> `Security & sign-in`, `Active sessions`) ketma-ket turadi; chapdagi punktlar shu
> kartalarga **scroll-anchor** vazifasini bajaradi (`/account#security`). Alohida sahifa
> emas — bitta sahifa, ichki anchor.
---

## 5. Umumiy komponentlar

Bu komponentlar **hamma joyda qayta ishlatiladi**. Ekran bo'limlarida (10-bo'lim) faqat
ularning `props` lari beriladi, ichki tuzilishi qayta yozilmaydi.

### 5.1. `<Button>`

| Variant | Ko'rinish | Misol |
|---|---|---|
| `primary` | `--primary` fon, oq matn, 36 px, `--radius-md` | `Add vehicle`, `Send to inspector` |
| `secondary` | Oq fon, `--border`, `--text` | `Export`, `Filters`, `Preview` |
| `ghost` | Fon yo'q, hover `--bg-subtle` | Jadval ichidagi `Logs` |
| `danger` | `--danger` fon, oq matn | `Delete unit` |
| `danger-outline` | Oq fon, `--danger` chegara va matn | `Remove`, `Revoke`, `Sign out everywhere` |
| `link` | Faqat matn, `--primary` | `View all`, `Download CSV template` |

O'lchamlar: `md` (36 px, default), `sm` (32 px), `lg` (40 px — modal footer'da).
Ikonka chapda 16 px, matndan 6 px masofa. Faqat-ikonka tugma 36×36.
`loading` — matn qoladi, chap ikonka o'rniga spinner, tugma `disabled`.

### 5.2. `<Badge>` / `<StatusBadge>`

Pill: balandlik 22 px, padding `2px 8px`, `--radius-full`, `--fs-badge`.
`dot` prop — matndan oldin 6 px doira.
Ranglar 3.1-bo'limdagi jadvaldan; `tone` prop: `success|warning|danger|info|violet|neutral`.

Maxsus variantlar:
- `Out of service` — `--danger-soft` fon, `--danger` matn, **nuqtasiz**
- `In progress` — `--info-soft`, `--info`, nuqtasiz
- `Open` — chegara `--border`, matn `--text-secondary`, fon yo'q
- `Uncertified · 2 days` — `--warning-soft`, nuqtali
- `L108` (firmware eskirgan) — badge emas, oddiy matn `--warning` rangda

### 5.3. `<KpiCard>`

Dizaynda **hamma joyda bir xil** (Dashboard, DVIR, Safety, Trips, IFTA, Reports, Histories, Devices):

```
┌──────────────────────────────────┐
│ Active vehicles           [icon] │   ← label 13/500 secondary, icon 20px o'ng yuqorida
│                                  │      icon fon: 32×32 --radius-md, tone-soft
│ 62   of 69                       │   ← qiymat 30/600, yonida chip yoki muted matn
└──────────────────────────────────┘
```

Props: `label`, `value`, `hint` (muted matn) yoki `chip` (`{text, tone}`), `icon`, `iconTone`.
Trend chipi: `↑ 5 vs yest.` (success), `↓ 9 vs prev.` (success — kamayish yaxshi bo'lsa),
`↑ 2 vs yest.` (danger — buzilish ko'paygan). **Trend yo'nalishi emas, ma'nosi rang beradi** —
har bir KPI uchun 10-bo'limda aniq yozilgan.

### 5.4. `<Card>` va `<SectionHeader>`

Karta: `--bg-surface`, `--border`, `--radius-lg`, `--shadow-card`, padding 20 px.
Header: chapda sarlavha (`--fs-card-title`) + ostida subtitle (`--fs-card-sub`);
o'ngda amal (tugma / `View all ›` link / chip).
Jadval kartasida header padding 20 px, jadval esa **chetdan chetga** (padding 0) chiqadi.

### 5.5. `<DataTable>`

TanStack Table ustida. Barcha jadvallar shu komponent.

**Tuzilishi:**
- Header: `--fs-table-head`, pastida 1px `--border`, sticky (karta ichida scroll bo'lsa)
- Qator: 48/54 px, pastida 1px `--border`, oxirgi qatorda chegara yo'q
- Hover: `--bg-subtle`
- Tanlangan qator: `--primary-soft` fon (Vehicles #101 dizaynda shunday)
- Raqamli ustunlar **o'ngga** tekislanadi (`ODOMETER`, `DISTANCE`, `SEVERITY`, `TAX DUE`)
- Oxirgi ustun amal bo'lsa — o'ngga tekislanadi, sarlavhasiz yoki `STATUS` bilan

**Ixtiyoriy elementlar (prop bilan yoqiladi):**
| Element | Qachon |
|---|---|
| Tanlash checkbox (chapdagi ustun + header "hammasi") | Faqat `FULL` ruxsatda va bulk amal bor ekranda |
| Qator `…` menyusi (`MoreHorizontal`) | Faqat `FULL` ruxsatda |
| Bulk action bar | Kamida 1 qator tanlanganda — 12.5-bo'lim |
| Pagination | 5.6-bo'lim |
| `Table settings` (ustun ko'rinishi) | Vehicles, Drivers (11.24) |

> ⚠️ **Read-only rollarda checkbox ustuni ham, `…` ustuni ham butunlay olib tashlanadi**
> (bo'sh ustun qoldirilmaydi). Dispatcher/Viewer Vehicles jadvalida bu aniq ko'rinadi.

### 5.6. `<Pagination>`

Jadval ostida, karta ichida, 56 px balandlik, yuqorisida `--border`:
- Chapda: `Rows per page:` + select (`10`, `25`, `50`, `100`) — default **10** (dizayn)
- O'ngda: `1–9 of 69 vehicles` + `‹` + sahifa raqamlari (`1 2 3 … 7`) + `›`
- Faol sahifa: `--primary` fon, oq matn, 32×32 `--radius-md`

Server `?page&limit` bilan ishlaydi (`OffsetPage<T>` javobi: `items,page,limit,total,totalPages`).

### 5.7. Filtr va segmentlar

**Segment tab'lar** (jadval ustida, chapda): `All 69` · `Active 62` · `Inactive 7` · `Unassigned 4`.
Faol: oq fon + `--border` + `--shadow-card`, matn `--text`; nofaol: fon yo'q, matn `--text-secondary`, son `--text-muted`.
Konteyner `--bg-subtle` emas — dizaynda tab'lar shaffof fonda, faqat faol tab oq karta.

**O'ng tomondagi qator:** qidiruv input (240 px) · `Status ▾` select · `Filters` tugmasi
(`Filter` ikonka; qo'llanilgan filtr bo'lsa yonida son: `Filters 3`) · `Import` · `Export` · asosiy CTA.

`Filters` bosilganda **o'ngdan chiqadigan drawer** (11.23), sahifa scroll bloklanadi.

### 5.8. `<HosMeter>`

Drivers jadvali va `Available hours` kartasida:
```
DRIVE LEFT · 11H          Drive                   00:00  limit exceeded
00:00                     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- Qiymat `HH:MM`, tabular-nums, rang 3.5-qoidasi bo'yicha
- `00:00` bo'lsa yoniga `limit exceeded` (11/400 `--danger`)
- Bar kengligi `remainingSec / limitSec`
- `Available hours` kartasida o'ng tomonda `of 14:00` / `of 70:00` / `of 08:00 driving` (muted)

### 5.9. Modal va Drawer

**Modal:** markazda, `--radius-xl`, `--shadow-modal`, orqa fon `--bg-overlay`.
Kengliklar: `sm` 460 px (o'chirish tasdig'i) · `md` 640 px (ko'pchilik forma) · `lg` 720 px.
Balandlik: kontent `max-height: calc(100vh - 96px)`, ichki scroll; **header va footer sticky**.
- Header: sarlavha 17/600 + subtitle 13/400 muted; o'ngda `X` (32×32, `--bg-subtle` hover)
- Footer: chapda ixtiyoriy checkbox (`Send the driver a pairing notification`), o'ngda
  `Cancel` (secondary) + ixtiyoriy oraliq tugma (`Save and add another`, `Save as draft`,
  `Test rule`, `Run once now`, `Download a copy`) + asosiy tugma
- `Esc` va orqa fon bosilishi — yopadi; **forma o'zgargan bo'lsa** `Discard changes?` tasdig'i
- Ochilganda fokus birinchi inputga; `Tab` modal ichida qamalgan (focus trap)

**Drawer:** o'ngdan, kengligi **380 px** (Filters, DVIR detail), to'liq balandlik,
`--shadow-modal`, footer sticky (`Reset all` + `Apply N filters`).

### 5.10. Toast

O'ng yuqorida (topbar ostida), 380 px, `--radius-lg`, `--shadow-pop`, chapda 20 px status ikonkasi,
sarlavha 14/600 + tavsif 13/400 muted, o'ngda `X`. Avtomatik yopilish: success 4 s, warning 6 s,
error — **yopilmaydi** (qo'lda). Bir vaqtda maksimum 3 ta, yangisi pastdan qo'shiladi.

Dizayndagi aniq misollar:
- ✅ `Unit #126 created` / `ELD PT30_1C4F paired and the driver was notified.`
- ❌ `Data transfer failed` / `The FMCSA endpoint returned 503. Retry or send by email.`
- ⚠️ `6 logs still uncertified` / `Two drivers have not signed logs for Sep 09 and Sep 10.`

### 5.11. Holat komponentlari

Manba: `sheets, modals, drawers, menus/Reports — inspection and defect history.jpg`
(«System states & feedback» sahifasi) — bu **dizayn tizimi sahifasi**, ekran emas.

| Komponent | Tuzilishi |
|---|---|
| `<EmptyState>` | 56 px doira `--bg-subtle` + ikonka `--text-muted`; sarlavha 15/600 (`No vehicles yet`); tavsif 13/400 muted, max 320 px, markazda; 2 ta tugma (`Import CSV` secondary + `Add vehicle` primary). Vertikal padding 48 px |
| `<LoadingState>` | Skeleton qatorlar: 32 px doira + 2 ta chiziq (60% va 40%) + o'ngda 64×20 blok. `--bg-subtle`, `animate-pulse`. Qator soni = kutilayotgan qatorlar (default 5) |
| `<ErrorState>` | 56 px `--danger-soft` doira + `AlertTriangle`; `Could not load the fleet`; `The telematics service did not respond. Your data is safe — try again in a moment.`; `Contact support` (secondary) + `Retry` (primary) |
| `<OfflineBanner>` | Qora (`--bg-inverse`) karta, 380 px, chapda ikonka; `You are offline` + `Showing data cached 4 minutes ago. Live tracking resumes automatically.`; o'ngda `Retry now`. **Chap pastda** fixed |
| `<SavedIndicator>` | Yashil (`--success-soft`) yupqa panel: `✓ All changes saved · last synced 12 seconds ago` + `View history` link |
| `<ProgressCard>` | `Generating FMCSA audit pack` + o'ngda `62%`; ostida 4 px bar; ostida `1,284 daily logs processed of 2,070 · about 40 seconds left` |

### 5.12. `<DateRangePicker>`

Ikki oylik kalendar + chapda presetlar (11.25). Trigger: `Sep 01 – Sep 10, 2025 ▾` yoki `Today ▾`.
Presetlar: `Today`, `Yesterday`, `Last 7 days`, `Last 14 days`, `Last 30 days`, `This month`,
`Last month`, `This quarter`, **`Last 8 days (HOS)`**, `Custom range`.

> `Last 8 days (HOS)` — FMCSA 8 kunlik oynasi; HOS va Transfers ekranlarida **default**.

### 5.13. `<DriverPicker>` / `<UnitPicker>`

Dropdown + qidiruv. Har bir qator: avatar + ism + ostida kontekst
(`Off duty · no unit assigned · Raleigh, NC`), o'ngda HOS qisqacha (`11:00 drive / 70:00 cycle`).
HOS ustuni rangi 3.5-qoidasi bo'yicha. Trigger HOS sahifasida: `JS John Smith ▾`.

### 5.14. `<Avatar>`

Doira, `--primary-soft` fon, `--primary` matn, initsiallar (`JS`, `MR`). Rasm bo'lsa — rasm.
Organisation kartada qora fon, oq matn.
---

## 6. API qatlami

### 6.1. Base URL va konvert

Backend `main.ts`: global prefix **`api`**, versiya yo'lda — **`/api/v1/...`** emas!
⚠️ Amaldagi kodda `app.setGlobalPrefix('api')` va controller yo'llari versiyasiz
(`@Controller('vehicles')`), ya'ni haqiqiy URL — **`/api/vehicles`**. `backend/tz.md` esa
`/v1/vehicles` deydi. **Web `VITE_API_BASE_URL` orqali ishlaydi** va default qiymat
`http://localhost:3001/api`. Agar backend keyinchalik `v1` qo'shsa — faqat env o'zgaradi,
kod o'zgarmaydi. `endpoints.ts` dagi yo'llar **prefikssiz** yoziladi.

**Muvaffaqiyatli javob (`TransformInterceptor`):**
```json
{ "data": <payload>, "traceId": "01J8X…", "timestamp": "2025-09-10T15:41:00.000Z" }
```
`client.ts` `data` ni ochib beradi; `traceId` ni xatolik hisobotlari uchun saqlaydi.

**Xato javobi (`AllExceptionsFilter`, `backend/tz.md` §20):**
```json
{ "statusCode": 422, "code": "DRIVING_TIME_IMMUTABLE",
  "message": "…", "details": { "eventId": "12345" },
  "traceId": "01J8X…", "timestamp": "…" }
```

**Ro'yxat javobi:** `{ items, page, limit, total, totalPages }` (`OffsetPage<T>`).
So'rov: `?page&limit&sort=field:asc|desc&q=` (`ListQueryDto`, `limit` max **200**).

### 6.2. `client.ts` qoidalari

1. `credentials: 'omit'` — token `Authorization: Bearer` sarlavhasida (cookie ishlatilmaydi)
2. `401` + `code=TOKEN_EXPIRED` → **bitta** refresh urinishi (`POST /auth/refresh`), keyin
   so'rov qayta yuboriladi. Parallel 401'lar bitta refresh promise'ini kutadi (single-flight)
3. Refresh ham `401` bersa → `AuthProvider.signOut()` → `/sign-in?reason=expired`
4. *(bekor qilingan — 2FA olib tashlandi, Q-4)*
5. `403` (oddiy) → `<ForbiddenState>` — sahifa o'rniga; toast **chiqmaydi**
6. `422` → forma xatosi: `details` dagi maydonlar `react-hook-form.setError` ga; maydon
   yo'q bo'lsa — modal ichida qizil banner
7. `5xx` / tarmoq → error toast + `Retry`; `GET` uchun 2 marta eksponensial retry (1 s, 3 s)
8. Har bir so'rovda `X-Client-Version: ${VITE_APP_VERSION}`
9. `AbortController` — komponent unmount bo'lsa so'rov bekor qilinadi

### 6.3. Query key fabrikasi

```ts
export const qk = {
  me:                        ['me'] as const,
  carrier:                   ['carrier'] as const,
  vehicles:  (p?: object) => ['vehicles', p ?? {}] as const,
  vehicle:   (id: string) => ['vehicles', id] as const,
  vehicleTelemetry: (id) =>  ['vehicles', id, 'telemetry'] as const,
  vehicleDtc:       (id) =>  ['vehicles', id, 'dtc'] as const,
  drivers:   (p?: object) => ['drivers', p ?? {}] as const,
  driver:    (id: string) => ['drivers', id] as const,
  logDay:  (d, date) =>      ['logs', d, 'day', date] as const,
  logRange:(d, f, t) =>      ['logs', d, 'range', f, t] as const,
  logEvents:(d, date) =>     ['logs', d, 'events', date] as const,
  editRequests: (d, s) =>    ['logs', d, 'edit-requests', s] as const,
  unidentified: (p) =>       ['unidentified', p ?? {}] as const,
  dvirs:     (p) =>          ['dvir', p ?? {}] as const,
  defects:   (p) =>          ['defects', p ?? {}] as const,
  workOrders:(p) =>          ['work-orders', p ?? {}] as const,
  schedules: (p) =>          ['maintenance-schedules', p ?? {}] as const,
  trips:     (p) =>          ['trips', p ?? {}] as const,
  safetyEvents:(p) =>        ['safety', 'events', p ?? {}] as const,
  scorecard: (p) =>          ['safety', 'scorecard', p ?? {}] as const,
  reports:   (p) =>          ['reports', p ?? {}] as const,
  transfers: (p) =>          ['transfers', p ?? {}] as const,
  devices:   (p) =>          ['devices', p ?? {}] as const,
  users:     (p) =>          ['users', p ?? {}] as const,
  roles:                     ['roles'] as const,
  alertRules:(p) =>          ['alert-rules', p ?? {}] as const,
  integrations:              ['integrations'] as const,
  apiKeys:                   ['api-keys'] as const,
  audit:     (p) =>          ['audit-log', p ?? {}] as const,
  tickets:   (p) =>          ['support', 'tickets', p ?? {}] as const,
  conversations:(p) =>       ['conversations', p ?? {}] as const,
  messages:  (id, p) =>      ['conversations', id, 'messages', p ?? {}] as const,
  notifications:(p) =>       ['notifications', p ?? {}] as const,
  sessions:                  ['me', 'sessions'] as const,
};
```

### 6.4. Kesh siyosati

| Ma'lumot turi | `staleTime` | `refetchInterval` | Izoh |
|---|---|---|---|
| `me`, `carrier`, `roles` | 5 daq | — | Kamdan-kam o'zgaradi |
| Ro'yxatlar (vehicles, drivers, users…) | 30 s | — | WS yoki `Refresh` yangilaydi |
| Live Fleet, Dashboard | 10 s | **30 s** | WS bo'lmaganda ham yangilanadi |
| HOS kunlik jurnal | 15 s | — | WS `eld.events_ingested` invalidate qiladi |
| Hisobot statusi (`QUEUED`/`RUNNING`) | 0 | **3 s** | `READY`/`FAILED` bo'lganda to'xtaydi |
| Transfer statusi | 0 | **5 s** | Terminal statusda to'xtaydi |
| Audit log, Reports ro'yxati | 60 s | — | |
| Messages (ochiq suhbat) | 0 | — | Faqat WS |

`refetchOnWindowFocus: true` — barcha ro'yxatlar uchun (dispetcher oynalar orasida yuradi).

### 6.5. Autentifikatsiya oqimi — Google (prod'dagi yagona yo'l)

> **Buyurtmachi qarori (2026-09-12): PROD'da web panelga kirishning yagona yo'li — Google
> hisobi (Gmail).** Hozircha, dev va staging'da **haqiqiy Gmail shart emas** — seed
> akkauntlari email + parol bilan kiradi. Ikkala rejim **§6.6** da yozilgan.

```
1. Firebase Web SDK → signInWithPopup(GoogleAuthProvider)  → Google ID token
2. POST /auth/google { idToken }
     ├─ 200 { accessToken, refreshToken, user }              → ilovaga kirish
     ├─ 401                                                  → token yaroqsiz / provayder ≠ google.com
     ├─ 403 USER_NOT_INVITED                                 → bu Gmail panelga taklif qilinmagan
     └─ 403 EMAIL_NOT_VERIFIED                               → Google email tasdiqlanmagan

POST /auth/refresh   { refreshToken }                  → yangi juftlik (rotatsiya)
POST /auth/logout                                      → sessiya bekor
GET  /auth/me                                          → { user, role, permissions }
```

**`POST /auth/login/driver`** — hech qachon web'dan chaqirilmaydi (mobil ilova uchun).
**`POST /auth/login`** — faqat **dev rejimida** (§6.6).
**`POST /auth/password/forgot` / `reset`** — web'da umuman ishlatilmaydi.

**Qat'iy qoida (`backend/tz.md` §6.2, o'zgarishsiz):**

1. **Avtomatik ro'yxatdan o'tish yo'q.** Google orqali kirish foydalanuvchi yaratmaydi.
   Admin avval `Invite user` orqali qo'shadi; email mos kelmasa → `403 USER_NOT_INVITED`.
2. **2FA yo'q (Q-4).** Google va dev parol oqimi darhol `{ accessToken, refreshToken }` qaytaradi.

**Firebase konfiguratsiyasi** (`.env`) — **majburiy**, ularsiz panelga umuman kirib bo'lmaydi:
`VITE_FIREBASE_API_KEY` · `VITE_FIREBASE_AUTH_DOMAIN` · `VITE_FIREBASE_PROJECT_ID`.
Firebase Console'da **Authorized domains** ro'yxatiga web domeni qo'shilgan bo'lishi shart,
aks holda popup ochilmaydi.

**Popup bloklangan bo'lsa** (brauzer sozlamasi): `signInWithPopup` xatosi
`auth/popup-blocked` → avtomatik `signInWithRedirect` ga o'tiladi.

### 6.6. ⭐ Ikki auth rejimi — `dev` va `production`

Yagona konfiguratsiya o'zgaruvchisi: **`VITE_AUTH_MODE`** (`dev` | `production`).

| | **`dev`** (hozirgi holat) | **`production`** |
|---|---|---|
| Google bilan kirish | ✅ bor (agar Firebase sozlangan bo'lsa) | ✅ **yagona yo'l** |
| Email + parol bilan kirish | ✅ **bor** — seed akkauntlar (§6.7) | ⛔ yo'q |
| Gmail haqiqiy bo'lishi | ❌ shart emas (`@…example` manzillar) | ✅ shart, `email_verified = true` |
| Drayver email manzili tasdiqlanishi | ❌ shart emas | ✅ shart (§6.8) |
| `POST /auth/login` | ochiq | backend **yopadi** (B-25) |

**Sign-in sahifasida (W-00) farq — bitta blok:**

```
production:            dev:
┌──────────────────┐   ┌──────────────────────────────┐
│ Continue with    │   │ Continue with Google         │
│ Google           │   ├──────── or ──────────────────┤
└──────────────────┘   │ ▾ Developer sign-in          │   ← yig'ilgan (collapsed)
                       │   Email    [            ]    │
                       │   Password [            ]    │
                       │   [ Sign in ]                │
                       │   Demo accounts: admin / fm  │
                       │   / dispatcher / viewer      │
                       └──────────────────────────────┘
```

**Amalga oshirish qoidalari:**

1. Dev bloki `import.meta.env.VITE_AUTH_MODE === 'dev'` gvardi ichida →
   prod build'da **tree-shake** bo'ladi va bundle'ga tushmaydi
2. Blok **yig'ilgan** holatda keladi (`Developer sign-in` sarlavhasi + chevron), ataylab
   ikkinchi darajali ko'rinishda: secondary tugma, kichik shrift, `--text-muted`
3. Blok ustida sariq chiziq: `Development mode — password sign-in is disabled in production.`
4. Prod build'da `VITE_AUTH_MODE` noto'g'ri qo'yilsa ham himoya bor: backend
   `POST /auth/login` ni `403 PASSWORD_LOGIN_DISABLED` bilan rad etadi (B-25)
5. E2E testlar **ikkala rejimda** ham o'tadi: dev'da parol bilan kiradi, prod
   konfiguratsiyasida esa parol formasi **umuman yo'qligini** tekshiradi

### 6.7. ⭐ Demo akkauntlar — har bir rol uchun bittadan

Dev DB (`onebook_eld_dev`) `prisma/seed.ts` bilan to'ldirilgan: jami **12 back-office
foydalanuvchi**. Ulardan **4 tasi** kanonik demo akkaunt deb belgilanadi — QA, dizayn
tekshiruvi va E2E testlar aynan shularni ishlatadi:

| Rol | Email | Parol | Chip (topbar) | Avatar |
|---|---|---|---|---|
| **ADMIN** | `sarah.chen@universal-logistics.example` | `Onebook2026` | chip yo'q | `SC` |
| **FLEET_MANAGER** | `mike.torres@universal-logistics.example` | `Onebook2026` | `● Fleet manager` | `MT` |
| **DISPATCHER** | `carlos.ramirez@universal-logistics.example` | `Onebook2026` | `● Dispatcher` | `CR` |
| **VIEWER** | `diane.foster@universal-logistics.example` | `Onebook2026` | `● Read-only · Viewer` | `DF` |

> ⚠️ Dizayn rasmlaridagi ismlar (`Sarah Chen`, `Mike Rowan`, `Dana Ford`, `Priya Nair`)
> bilan seed'dagi ismlar to'liq mos emas — faqat **Sarah Chen** ikkalasida bir xil.
> Bu muammo emas: rasm mock ma'lumot bilan chizilgan. Rol chipi va ruxsatlar to'g'ri
> bo'lsa yetarli. Xohlansa seed ismlarini rasmga moslash mumkin (B-33, ixtiyoriy).

**2FA:** yo'q (Q-4) — barcha seed akkauntlar, ADMIN ham, faqat email+parol bilan kiradi.

**Qolgan 8 foydalanuvchi** o'chirilmaydi — ular `Settings › Users` jadvalini realistik
qiladi (`12 back-office users · 3 admins`).

### 6.8. ⭐ Drayver akkauntlari — web'dan yaratiladi

Drayver **web panelga kirmaydi**. Web'dagi vazifa — drayver akkauntini **yaratish** va
unga kirish ma'lumotlarini berish.

| Kim yaratadi | Qanday |
|---|---|
| `drivers: FULL` huquqiga ega har qanday rol — sukut bo'yicha **ADMIN** va **FLEET_MANAGER** | `Drivers › + Add driver` (11.8) yoki `Import` (11.7) |
| Boshqa rolga ham berish mumkin | `Settings › Roles & permissions › + Create role` (11.19) da `Drivers = Full` qo'yiladi |

**Drayverning kirish ma'lumotlari — hozirgi (dev) holat:**

| Maydon | Kim beradi | Izoh |
|---|---|---|
| `Email address *` (**Gmail**) | Web'da admin kiritadi | Drayver shu manzil bilan **mobil ilovaga** kiradi. Hozircha manzil haqiqiy bo'lishi shart emas |
| `Password *` | Web'da admin kiritadi (min 8) | Drayverga og'zaki/email orqali beriladi |
| `Username` | Web'da admin kiritadi | Eski usul — qoladi, lekin kirish uchun **email ham qabul qilinadi** (B-29) |

**Prod'ga chiqqanda (rejalashtirilgan):**

1. Admin drayver uchun **haqiqiy Gmail** kiritadi
2. Web'dan `Send verification` bosiladi → drayverga tasdiqlash xati ketadi
3. Drayver tasdiqlaguncha profilida `● Email not verified` (warning) badge turadi va
   `Drivers` jadvalida ham ko'rinadi
4. Tasdiqlangach drayver mobil ilovada **Google bilan** kiradi (parol kerak emas)
5. Tasdiqlanmagan drayver uchun `Assign trip` va `Send invitation` **bloklanadi**

Bu oqim uchun backend talablari: **B-29, B-30, B-31** (20-bo'lim).

**Token saqlash:**
- `accessToken` — **faqat xotirada** (JS o'zgaruvchi), `localStorage` ga yozilmaydi
- `refreshToken` — `localStorage` (`obk.rt`), chunki backend cookie bermaydi.
  XSS xavfi CSP va `dangerouslySetInnerHTML` taqig'i bilan qoplanadi
- Sahifa yangilanganda: `refresh` → yangi access → `GET /auth/me` → ilova ochiladi.
  Bu davrda **to'liq sahifa skeleton'i** (logo + spinner)
- Access muddati 15 daqiqa; **muddati tugashiga 60 s qolganda** fonda proaktiv refresh

### 6.9. Ruxsat modeli (frontend)

`GET /auth/me` javobidagi `permissions` — 22 kalit → `'NONE' | 'READ' | 'FULL'`.
JWT ichidagi `per` ham shu (`backend/tz.md` §6.3), lekin **JWT dekodlanmaydi** — faqat `/auth/me`.

```ts
const can = (key: PermissionKey, level: 'READ' | 'FULL' = 'READ') =>
  level === 'READ' ? perm[key] !== 'NONE' : perm[key] === 'FULL';
```

**Uch qatlamli qo'llash:**
1. **Route guard** — `NONE` bo'lsa route umuman ro'yxatdan o'tmaydi → `/403`
2. **Navigatsiya** — `NONE` bo'lsa menyu punkti yo'q (4.2-jadval)
3. **Element** — `<Can perm="hosEdit" level="FULL">` bilan tugma/ustun/menyu punkti o'raladi

> **Qoida:** yashirilgan tugma **hech qachon disabled ko'rinishda qoldirilmaydi**.
> Ruxsat yo'q — element DOM da yo'q. (`backend/tz.md` §6.4: «Menyu punkti va tugma
> ko'rsatilmaydi».) Yagona istisno — `Admin cannot be edited` chipi (11.16).

**22 kalit va ular boshqaradigan UI (to'liq):**

| Kalit | Nimani boshqaradi |
|---|---|
| `dashboard` | `/` route |
| `liveFleet` | `/live-fleet`, `Track on map`, geofence CRUD |
| `vehicles` | `/vehicles*`, `Add vehicle`, `Edit unit`, `Import`, `Delete unit`, `Calibrate odometer`, `Assign driver` |
| `drivers` | `/drivers*`, `Add driver`, `Edit driver`, `Import`, `Deactivate`, `Reset app password` |
| `hos` | `/hos-logs`, `Recent daily logs`, `Export PDF`, `Open logs` |
| `hosEdit` | `Add / edit event`, `Request a log edit`, `Resolve` (violations), unassigned `Assign`/`Annotate`/`Reject` |
| `hosCertifyOnBehalf` | `Certify all` va `Certify logs` modali (**faqat ADMIN**) |
| `dvir` | `/dvir`, DVIR drawer, `Resolve defect`, `Mechanic sign-off` |
| `maintenance` | `Work orders` / `Schedules` tab'lari, `New work order`, `Create work order` |
| `safety` | `/safety`, `Assign coaching`, coaching statusini o'zgartirish |
| `trips` | `/trips`, `Create trip`, `Assign driver` (load), `Auto-assign` |
| `reports` | `/reports*`, `Generate report`, `Export CSV`, `Download PDF`, `Schedule a report` |
| `reportsTransfer` | `Send to inspector`, `Send transfer`, `Generate pack`, `Previous transfers` |
| `messaging` | `/messages`, `New`, xabar yuborish, `Broadcast` |
| `devices` | `/settings/devices`, `Register device`, `Pair`/`Unpair`, firmware |
| `alertRules` | `/settings/alerts`, `New rule`, kanal toggle'lari |
| `users` | `/settings/users`, `Invite user`, `Resend`, `Revoke`, `Disable` |
| `roles` | `/settings/roles`, `Create role`, matritsa yacheykalari, `Reset to defaults` |
| `integrations` | `/settings/integrations`, `Connect`/`Manage`, `Create key` |
| `auditLog` | `/settings/audit`, `Export CSV` |
| `support` | `/settings/support`, `New ticket`, `Send feedback` |
| `carrierSettings` | `/settings/company`, `Save changes` |

**Rol matritsasi** — `backend/tz.md` §6.4 dagi jadval **o'zgarishsiz** qabul qilinadi
(22 kalit × 4 rol). Frontend uni **hardcode qilmaydi**, `/auth/me` dan oladi;
`permissions.ts` dagi nusxa faqat **testlar va rol matritsasi ekrani** uchun.
---

## 7. Real-time

### 7.1. Amaldagi backend (kod bo'yicha, TZ bo'yicha emas)

`backend/src/modules/realtime/realtime.gateway.ts`:

| Xususiyat | Amalda |
|---|---|
| Transport | Socket.IO, **namespace `/realtime`** (tz.md dagi `/ws` emas) |
| Auth | `io(url, { auth: { token } })` — **handshake'da**, query string'da emas |
| Auth muvaffaqiyatsiz | Server socketni **uzadi** (`disconnect(true)`) |
| Avtomatik xona | Ulanganda `user:{id}` ga o'zi qo'shiladi |
| Obuna | `socket.emit('subscribe', 'fleet', cb)` → `{ ok: true|false }` |
| Obunani bekor qilish | `socket.emit('unsubscribe', 'fleet', cb)` |
| Ruxsat etilgan xonalar | `fleet`, `violations`, `vehicle:{id}`, `driver:{id}`, `user:{id}`, `conversation:{id}` |
| CORS | `CORS_ORIGINS` env ro'yxati |
| **`resume` / `seq`** | **YO'Q** (tz.md §12.3 rejalashtirgan, kod hali yo'q) |
| **Token yangilash** | **YO'Q** — token muddati tugasa ulanish uziladi |

### 7.2. Frontend qoidalari

```ts
const socket = io(`${VITE_WS_URL}/realtime`, {
  auth: { token: accessToken },
  transports: ['websocket', 'polling'],   // korporativ Wi-Fi uchun fallback
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,               // jitter (§12.2)
});
```

1. **Ulanish** — foydalanuvchi autentifikatsiyadan o'tgach bir marta; `AuthProvider` ostida
2. **Token yangilanganda** — `socket.auth = { token }` + `socket.disconnect().connect()`
   (backend renew qo'llab-quvvatlamaydi; uzilish 200 ms dan kam, foydalanuvchi sezmaydi)
3. **`resume` yo'qligini qoplash:** `reconnect` hodisasida **joriy ekranning barcha
   query'lari `invalidateQueries` bilan qayta yuklanadi**. Bu tz.md §12.3 dagi
   `truncated: true` xatti-harakatining ekvivalenti va u yo'qligicha yagona to'g'ri yechim
4. **Xonaga obuna faqat kerak bo'lganda** — `useRoom('fleet')` hook'i mount'da `subscribe`,
   unmount'da `unsubscribe` qiladi (§12.4 qoidasi)
5. **Throttle** — `fleet.position` (kelajakda) va `telemetry.point` uchun frontend
   **200 ms** debounce bilan state yangilaydi, har hodisada render qilmaydi
6. **Ulanish holati** — `disconnected` bo'lsa `<OfflineBanner>`; qayta ulanganda banner
   yashil `Reconnected` toast'ga aylanib 3 s dan keyin yo'qoladi

### 7.3. Hodisalar — amalda mavjud

| Hodisa | Xona | Payload | Web nima qiladi |
|---|---|---|---|
| `notification.new` | `user:{id}` | `{ notification }` | Bell'ga nuqta, panel keshiga qo'shish, `severity=CRITICAL` bo'lsa toast |
| `message.new` | `conversation:{id}` | `{ message }` | Suhbatga qo'shish, ro'yxatda tartibni yangilash, o'qilmagan hisoblagich |
| `trip.status_changed` | `fleet` | `{ tripId, status, eta }` | Trips jadvalidagi qatorni yangilash, KPI invalidate |
| `safety.event_created` | `fleet` | `{ vehicleId, driverId, type, severity }` | Safety ro'yxati invalidate, sidebar `Safety` badge +1 |
| `geofence.transition` | `fleet` | `{ vehicleId, geofenceId, kind }` | Live Fleet xaritasida qisqa flash |
| `report.ready` | `user:{id}` | `{ reportId, type, status }` | `Report ready` toast + `Download` amali; Reports ro'yxati invalidate |
| `eld.events_ingested` | `vehicle:{id}` | `{ vehicleId, count }` | Ochiq unit/HOS sahifasida `logDay`/`logEvents` invalidate |
| `telemetry.point` | `vehicle:{id}` | `{ vehicleId, count }` | Unit `Live status` kartasini invalidate (throttled) |
| `device.ble_state` | `vehicle:{id}` | `{ deviceSerial, state }` | Unit sarlavhasidagi `BLE connected` chipini yangilash, Devices jadvali |

### 7.4. Hodisalar — hali yo'q (backend gap)

`backend/tz.md` §12.5 va'da qilgan, lekin kodda yo'q:
`fleet.position` · `driver.status_changed` · `hos.updated` · `violation.created` ·
`unidentified.created` · `dvir.submitted` · `defect.created` · `edit_request.created` ·
`edit_request.resolved` · `device.backlog` · `sync.required`

**Vaqtinchalik yechim (v1 da amalga oshiriladi):** ular kerak bo'lgan ekranlar
`refetchInterval` bilan ishlaydi — Dashboard va Live Fleet **30 s**, HOS Logs **60 s**
(faqat sahifa ko'rinib turganda: `document.visibilityState === 'visible'`).
Hodisalar qo'shilgach polling **o'chiriladi** — bu 20-bo'limdagi gap ro'yxatida.

### 7.5. Xona → ekran xaritasi

| Ekran | Obuna bo'ladigan xonalar |
|---|---|
| Dashboard | `fleet`, `violations` |
| Live Fleet | `fleet` (+ tanlangan unit uchun `vehicle:{id}`) |
| Vehicles ro'yxati | `fleet` |
| Unit detali / Histories | `vehicle:{id}` |
| Drivers ro'yxati | `fleet`, `violations` |
| Driver detali | `driver:{id}` |
| HOS Logs | `driver:{id}`, `violations` |
| DVIR & Maintenance | `fleet`, `violations` |
| Safety | `fleet` |
| Dispatch & Trips | `fleet` |
| Messages | ochiq suhbat uchun `conversation:{id}` |
| Reports / Transfers | (avtomatik) `user:{id}` |
| Settings › ELD devices | `fleet` |
---

## 8. Formatlash, birliklar va vaqt mintaqalari

Butun ilova bo'ylab **bitta** modul: `shared/format/`. Qamrov talabi — **100%**.

### 8.1. Birliklar

Backend hamma narsani **imperial** qaytaradi (`backend/tz.md` §4.2). Frontend
**konvertatsiya qilmaydi**, faqat formatlaydi.

| Qiymat | Format | Misol |
|---|---|---|
| Masofa | `toLocaleString('en-US')` + ` mi` | `993,589 mi` · `482 mi` |
| Tezlik | butun son + ` mph` | `61 mph` · `0 mph` |
| Yoqilg'i | `toLocaleString` + ` gal` | `62,410 gal` · `2.4 gal wasted` |
| MPG | 1 kasr | `6.4` |
| Dvigatel soati | `1,070 h 12 m` (KPI) yoki `1070.2 h` (jadval) |
| Harorat | butun + ` °C` | `79 °C` |
| Kuchlanish | 1 kasr + ` V` | `13.9 V` |
| Foiz | butun + `%` | `78%` |
| Vazn | `toLocaleString` + ` lbs` | `21,300 lbs` |
| Pul | `$` + `toLocaleString(2 kasr)` | `$2,184.30` · `$  871.05` (o'ngga tekislangan) |
| G-kuch | ishorasi bilan, 2 kasr + ` g` | `-0.42 g` · `0.38 g` |

### 8.2. Vaqt formatlari

| Nima | Format | Misol |
|---|---|---|
| HOS soat (qolgan/sarflangan) | `HH:MM`, **tabular-nums**, doim 2 xona | `00:19` · `11:26` · `70:00` |
| Kunlik jami | `HH:MM` | `07:30 · 02:00 · 11:26 · 03:04` |
| Hodisa vaqti (log events) | `HH:MM:SS` | `14:26:58` |
| Jadval vaqti | `HH:MM` (24 soat) | `05:30` · `17:40` |
| Sana + vaqt | `MMM DD, HH:MM` | `Sep 10, 05:12` |
| To'liq sana-vaqt | `MMM DD, HH:MM:SS` | `Sep 10, 15:42:08` |
| Sana (uzun) | `EEE, MMM d, yyyy` | `Wed, Sep 10, 2025` |
| Sana (qisqa) | `MMM dd, yyyy` | `Sep 11, 2025` |
| Oraliq | `MMM dd – MMM dd, yyyy` | `Sep 01 – Sep 10, 2025` |
| Nisbiy | `2 minutes ago`, `1 h`, `4 h`, `Yesterday`, `2 d`, `just now` | Jadval `LAST SYNC`, suhbat |
| Aralash | `HH:MM · N ago` | `14:26 · 1h ago` |
| Davomiylik | `05h 30m` (segment) yoki `12h 40m` (KPI) |
| Kelajak | `Due in 3,100 mi · Sep 24` · `Due in 41 days · Oct 21` |

**Nisbiy vaqt qoidasi:** `< 60 s` → `just now` · `< 60 daq` → `N minutes ago` /
jadvalda qisqa `12 min` · `< 24 s` → `N h` · kecha → `Yesterday` · `< 7 kun` → `N d` ·
undan eski → sana. Har **30 sekundda** qayta hisoblanadi (`useRelativeTime` hook).

### 8.3. Vaqt mintaqasi — ⭐ eng ko'p xato qilinadigan joy

Backend barcha vaqtlarni **UTC ISO** qaytaradi. Ko'rsatishda uch xil mintaqa ishlatiladi:

| Kontekst | Qaysi mintaqa | Manba | Ko'rsatkich |
|---|---|---|---|
| **RODS / HOS** (grid, kunlik jami, sertifikatlash, log events, transfer oralig'i) | **`driver.homeTerminalTimezone`** | `GET /drivers/:id` yoki `logs` javobidagi `timezone` | Sarlavhada `Home terminal: Columbus, OH (Eastern)`, grid ostida `all times Eastern` |
| **Kompaniya konteksti** (Dashboard subtitle, audit log, hisobot oraliqlari, tiketlar) | **`carrier.timezone`** | `GET /carrier` | Subtitle oxirida `· ET` |
| **Foydalanuvchi lokali** (nisbiy vaqt, `Now · this device`) | Brauzer | — | — |

> ⚠️ **Qat'iy:** HOS ekranida hech qachon brauzer mintaqasi ishlatilmaydi. Drayver
> Columbus'da, dispetcher Toshkentda bo'lishi mumkin — jurnal **drayverning** kuni bo'yicha
> bo'linadi (`backend/tz.md` §5.3, §8.1). `formatRods(iso, driverTz)` — alohida funksiya,
> `formatLocal` dan farqli. ESLint qoidasi: `hos-logs/` va `logs` bilan ishlaydigan
> fayllarda `formatLocal` ishlatish taqiqlanadi.

DST: `date-fns-tz` ishlatiladi; 23/25 soatlik kunlarda grid kengligi **o'zgarmaydi**
(24 ustun qoladi), lekin segment koordinatalari `dayLengthSec` ga nisbatan hisoblanadi
(backend `summary.dayLengthSec` beradi).

### 8.4. Bo'sh qiymatlar

| Holat | Ko'rinishi |
|---|---|
| Qiymat yo'q (jadval) | `—` (em-dash), `--text-muted` |
| Biriktirilmagan drayver/unit | `Unassigned`, `--text-muted`, kursiv **emas** |
| Qurilma yo'q | `Not assigned`, `--text-muted` |
| Defekt yo'q | `None`, `--text-muted` |
| Topshirilmagan DVIR | `Not submitted`, `--warning` |
| Hech qachon sinxronlanmagan | `—` |

### 8.5. Raqamlarni yaxlitlash

Frontend **hech qachon yaxlitlamaydi** — backend allaqachon yaxlitlagan
(`kmToMi` → butun, `lToGal` → 2 kasr). Frontend faqat mingliklarni ajratadi.
Istisno: foizlar (`93.5%`) va MPG backend'dan tayyor keladi.
---

## 9. Route jadvali

| Route | Ekran | Perm | Rollar |
|---|---|---|---|
| `/sign-in` | Sign in (**faqat Google**) | public | — |
| `/` | Fleet Dashboard | `dashboard` | hammasi |
| `/live-fleet` | Live Fleet | `liveFleet` | hammasi |
| `/vehicles` | Vehicles | `vehicles` READ | hammasi |
| `/vehicles/:id` | Unit profile | `vehicles` READ | hammasi |
| `/vehicles/:id/histories?date=` | Unit histories | `vehicles` READ | hammasi |
| `/drivers` | Drivers | `drivers` READ | hammasi |
| `/drivers/:id` | Driver profile | `drivers` READ | hammasi |
| `/trips` | Dispatch & Trips | `trips` | A/FM/D |
| `/hos-logs?driverId=&date=` | HOS · Driver log | `hos` READ | hammasi |
| `/dvir` | DVIR & Maintenance | `dvir` READ | A/FM/V |
| `/safety` | Safety | `safety` READ | A/FM/V |
| `/reports` | → `/reports/ifta` ga redirect | `reports` READ | hammasi |
| `/reports/ifta` | Reports · IFTA | `reports` READ | hammasi |
| `/reports/activity` | Reports · Activity | `reports` READ | hammasi |
| `/reports/dvir` | Reports · DVIR | `reports` READ | A/FM/V |
| `/reports/fmcsa` | Reports · FMCSA / DOT | `reportsTransfer` READ | A/FM |
| `/messages` | Messages | `messaging` | A/FM/D |
| `/settings/*` | Settings (4.6) | har xil | har xil |
| `/settings/support/feedback` | Support · Feedback | `support` | hammasi |
| `/account` | My profile | — | hammasi |
| `/403` | Ruxsat yo'q | — | — |
| `*` | 404 | — | — |

**Route guard tartibi:** `isAuthenticated` → `can(perm)` → ekran.

**Deep-link:** har bir modal URL bilan bog'lanmaydi (v1), **bundan tashqari**:
`/vehicles/:id`, `/drivers/:id`, `/hos-logs?driverId=&date=`, `/vehicles/:id/histories?date=`
va `/reports/*`. Ular to'liq shareable bo'lishi shart.

---

## 10. Ekranlar

> Har bir ekran nomi yonida dizayn fayli ko'rsatilgan:
> `📐 admin panel/<fayl>.jpg`

---

### W-00 · Sign in
**📐 `.tmp_docimg/shared-login.png`** · Route `/sign-in` · Public

**Layout:** ikkiga bo'lingan ekran, `50% / 50%`.

**Chap panel** — `--bg-inverse` (#0F172A), padding 56 px:
- Yuqorida brand: 40 px ko'k plitka + `OneBook ELD` (oq) + `Fleet Manager` (muted)
- Markazda sarlavha 40/48/600 oq: `Every log, every unit, every inspection — audit ready.`
- Ostida 15/22 `--text-muted`: `FMCSA-registered ELD with real-time HOS, DVIR, IFTA and DOT data transfer for carriers of any size.`
- 3 ta statistika kartasi (bir qatorda, `rgba(255,255,255,.06)` fon, `--radius-md`):
  `69 / units connected` · `58 / active drivers` · `99.9% / ELD uptime`
- Pastda sitata kartasi: `"Roadside inspections went from a scramble to two clicks. eRODS transfer has never failed us."` + `SC` avatar + `Sarah Chen` / `Safety Director · Universal Logistics`

> Statistika **statik matn** (marketing), API dan olinmaydi — kirmagan foydalanuvchiga
> kompaniya raqamlarini ko'rsatish mumkin emas.

**O'ng panel** — `--bg-app`, markazda 400 px karta (`--radius-xl`, `--shadow-card`, padding 32 px):

> ⚠️ **Bu blok dizayndan farq qiladi.** Buyurtmachi qaroriga ko'ra **prod'da** web
> panelga kirish faqat Google (Gmail) orqali. Dizayndagi `Forgot password?` havolasi,
> `Keep me signed in` checkbox'i va `Continue with SAML single sign-on` tugmasi
> **butunlay olib tashlanadi**. Email + parol formasi esa **faqat dev build'da**,
> yig'ilgan `Developer sign-in` bloki ichida qoladi (§6.6).
> Kartaning qolgan tuzilishi (kenglik, radius, soya, footer) o'zgarmaydi.

- `Sign in to your account` (22/600)
- `Back-office access for fleet managers and administrators.` (13 muted)
- **`Continue with Google`** — yagona amal tugmasi: to'liq kenglik, **48 px**, oq fon,
  `--border`, `--radius-md`, chapda 18 px Google logotipi (rangli SVG, inline),
  matn 15/500 `--text`; hover `--bg-subtle`; bosilganda spinner + `Signing in…`
- Ostida 12/muted, markazda: `Access is granted by invitation. Ask your administrator to
  invite your work Google account.`
- **`VITE_AUTH_MODE=dev` bo'lganda** (prod build'da bu blok umuman yo'q):
  - Ajratkich `─── or ───`
  - Sariq chiziq (`--warning-soft`, 12/400):
    `Development mode — password sign-in is disabled in production.`
  - Yig'iluvchi blok: `▾ Developer sign-in` (14/500 `--text-secondary`, chevron o'ngda).
    Ochilganda: `Email` input · `Password` input (`Eye` toggle) · `Sign in` (secondary,
    to'liq kenglik, 40 px)
  - Ostida 12/muted, bir qatorda: `Demo accounts: admin · fleet manager · dispatcher ·
    viewer` — har biri bosiladigan link, bosilganda ikkala maydonni **avtomatik
    to'ldiradi** (§6.7 jadvali)
- Ajratkich (1px `--border`), ostida 12/muted, markazda:
  `Drivers should use the OneBook ELD mobile app, not this portal.`
- Karta ostida footer: `© 2025 OneBook ELD` · `Privacy Policy` · `Terms of Use` ·
  `FMCSA registration #ONEB01`

**Amal:**

| Amal | Oqim | Natija |
|---|---|---|
| `Continue with Google` | Firebase `signInWithPopup(GoogleAuthProvider)` → ID token → `POST /auth/google` | `accessToken` → `/` |
| `Sign in` (**faqat dev**) | `POST /auth/login { email, password }` | Xuddi shunday. Prod konfiguratsiyasida bu tugma **yo'q**, backend ham `403 PASSWORD_LOGIN_DISABLED` qaytaradi |

**Xatolar (karta ichida qizil banner):**

| Holat | Matn |
|---|---|
| `403 USER_NOT_INVITED` | `This Google account is not invited to the panel. Ask an administrator for an invitation.` |
| `403 EMAIL_NOT_VERIFIED` | `Verify your Google email address first.` |
| `403 USER_DISABLED` | `This account has been disabled. Contact your administrator.` |
| `401` | `Google sign-in failed. Try again.` |
| Firebase `auth/popup-closed-by-user` | Banner **chiqmaydi** — foydalanuvchi o'zi yopgan |
| Firebase `auth/popup-blocked` | Avtomatik `signInWithRedirect`; muvaffaqiyatsiz bo'lsa: `Allow pop-ups for this site to sign in with Google.` |
| Firebase `auth/network-request-failed` | `Could not reach Google. Check your connection.` |
| `429` | `Too many attempts. Try again in a minute.` |
| `401 INVALID_CREDENTIALS` (**dev**) | `Incorrect email or password.` |
| `403 PASSWORD_LOGIN_DISABLED` | `Password sign-in is disabled. Use Continue with Google.` |

**Qabul mezoni:** ⬜ Chap panel matnlari aynan · ⬜ `Continue with Google` — asosiy amal ·
⬜ **prod build'da email/parol formasi bundle'da ham yo'q** · ⬜ dev build'da `Developer
sign-in` yig'ilgan holda va 4 ta demo akkaunt linki ishlaydi ·
⬜ **`Forgot password?` yo'q** · ⬜ SAML o'rniga Google ·
⬜ popup bloklanganda redirect · ⬜ `USER_NOT_INVITED` alohida matn ·
⬜ Kirgan foydalanuvchi `/sign-in` ga kirsa `/` ga redirect

---

### W-00b · Two-factor — ⛔ olib tashlandi (Q-4, 2026-09-13)
Qurilmaydi. `/sign-in/2fa` route'i yo'q.

---

### W-00c · Forgot / reset password — ⛔ QURILMAYDI

Prod'da parol umuman yo'q (faqat Google), dev'dagi parollar esa seed'dan keladi va
`prisma/seed.ts` orqali tiklanadi. Shuning uchun `/forgot-password` va `/reset-password`
route'lari **ikkala rejimda ham yaratilmaydi**.

Foydalanuvchi hisobiga kira olmasa — bu Google tomonidagi muammo (u yerda tiklaydi) yoki
hisob o'chirilgan/taklif qilinmagan. Ikkinchi holatda W-00 dagi banner nima qilish
kerakligini aytadi.

> **Drayverlar bundan mustasno:** mobil ilovada drayver `username + parol` bilan kiradi
> (`POST /auth/login/driver`) va uning parolini admin `Drivers › … › Reset app password`
> orqali tiklaydi. Bu **web panelga kirish emas** — drayver web'ga umuman kira olmaydi.
---

### W-01 · Fleet Dashboard
**📐 `*/Fleet overview — KPIs, live map, duty mix, violation feed.jpg`** (4 rolda ham bor)
Route `/` · Perm `dashboard` READ

**Header:** `Fleet Dashboard` · subtitle `Universal Logistics Inc. · Today, Sep 10 2025 · ET`
(carrier nomi + carrier mintaqasidagi bugungi sana + mintaqa qisqartmasi).
O'ngda kontekst filtri **`Today ▾`** (5.12 presetlari).

**Layout:**
```
[KPI ×4                                                        ]
[ Live fleet  (1fr)                    ][ Duty status · now  (348px) ]
[ HOS violations & alerts   (to'liq kenglik)                          ]
```

#### KPI qatori

| # | Label | Qiymat | Yon element | Manba |
|---|---|---|---|---|
| 1 | `Active vehicles` | `62` | muted `of 69` | `vehicles?status=ACTIVE` total / umumiy |
| 2 | `Drivers on duty` | `42` | success chip `↑ 5 vs yest.` | duty ON+D+SB soni |
| 3 | `HOS violations · 24h` | `6` | **danger** chip `↑ 2 vs yest.` | ochiq buzilishlar |
| 4 | `Unassigned driving` | `12h 40m` | warning chip `9 segments` | `unidentified?status=PENDING` |

Ikonkalar: `Truck` (info), `Users` (success), `AlertTriangle` (danger), `Clock` (warning).

#### `Live fleet` kartasi
- Header: `Live fleet` + subtitle `28 moving · 9 idle · 32 ELD offline`; o'ngda
  `Open map view` (secondary, `MapPin`) → `/live-fleet`
- Xarita 260 px balandlik, `--radius-md`, karta padding'idan chetga chiqmaydi
- Marker: 28 px doira, oq halqa, ichida `Truck`; rangi duty status bo'yicha
- Klaster: to'q ko'k doira, oq raqam (`12`, `18`)
- Bitta unit tanlanganda **hover-kartochka**: `Unit #101` + `● On-duty` badge;
  `John Smith · On duty`; `0.64 mi N of Florence, KY · 2 min ago`;
  **`Shift ends in 00:19:34`** — `--warning`, tirik hisoblagich (har sekundda)
- Chap pastda legend: `● Driving  ● On-duty  ● Sleeper  ● Off-duty`

> Tirik hisoblagich: backend `shiftEndsAt` beradi; frontend `setInterval(1000)` bilan
> sanaydi. `00:00:00` ga yetganda qizil bo'ladi va sanashni to'xtatadi.

#### `Duty status · now` kartasi
- Subtitle `58 drivers · 42 on duty`
- Donut (Recharts): tashqi radius 78, ichki 58, markazida `58` (30/600) + `on duty` (12 muted)
- Ostida legend jadvali — nuqta + nom, o'ngda son (600) va foiz (muted):
  `Driving 28 48%` · `On-duty (not driving) 14 24%` · `Sleeper berth 9 16%` · `Off-duty 7 12%`
- Segment hover — tooltip + segment 4 px kattalashadi
- Segment bosilganda → `/drivers?status=<...>`

#### `HOS violations & alerts` jadvali
Header: `HOS violations & alerts` + `Last 24 hours`; o'ngda `View all ›` → `/hos-logs`

| Ustun | Kenglik | Tarkib |
|---|---|---|
| `SEVERITY` | 120 | Badge: `Violation` (danger) · `Warning` (warning) · `Info` (info) |
| `DRIVER` | 200 | Avatar + ism |
| `UNIT` | 80 | `#101` (600) |
| `EVENT` | 1fr | `11-hour driving limit exceeded` · `Missing certification · 3 days` · `30-min break due in 00:18` · `ELD disconnected · 46 min` · `Unassigned driving · 1h 12m` |
| `LOCATION` | 220 | `1.04 mi W of Harrisburg, OH` |
| `TIME` | 140 | `14:26 · 1h ago` |
| — | 48 | `…` menyu — **faqat `hosEdit` FULL** |

`…` menyusi: `Open HOS logs` · `Send message` · `Resolve` · `Assign to driver` (unassigned uchun).
Qator bosilganda → `/hos-logs?driverId=<id>&date=<date>`.

**Rol farqlari:**
- ADMIN/FM/DISPATCHER — bir xil
- ⚠️ **VIEWER:** jadvalda `…` ustuni **yo'q** (dizaynda aniq)
- Rol chipi 4.4 bo'yicha

**Real-time:** `fleet`, `violations`. Hozircha `safety.event_created` va
`trip.status_changed` keladi; qolgani uchun **30 s polling**.

**Holatlar:** loading — KPI skeleton (4 ta karta), xarita `--bg-subtle` blok, jadval 5 skeleton qator ·
empty (yangi carrier) — KPI `0`, jadval o'rniga `<EmptyState>` `No violations in the last 24 hours` ·
error — har bir karta mustaqil `<ErrorState>` (bittasi tushsa boshqasi ishlaydi).

**Qabul mezoni:** ⬜ 4 KPI aynan matn va chiplar · ⬜ donut foizlari yig'indisi 100% ·
⬜ `Shift ends in` tirik sanaydi · ⬜ Viewer'da `…` yo'q · ⬜ jadval qatori HOS logs'ga
to'g'ri sana bilan o'tadi · ⬜ `Today ▾` o'zgarganda KPI va jadval qayta yuklanadi

---

### W-02 · Live Fleet
**📐 `*/Real-time GPS map, vehicle list, unit detail card.jpg`**
Route `/live-fleet` · Perm `liveFleet` READ

**Header:** `Live Fleet` · `Real-time GPS · refreshed 8 seconds ago` (tirik yangilanadi).
O'ngda **`All vehicle groups ▾`**.

**Layout:** to'liq balandlik (topbar ostidan pastgacha), **padding yo'q**:
```
[ Unit ro'yxati 300px ][ Xarita 1fr ]
```

#### Chap ustun
- Qidiruv: `Search unit, driver, plate…` (padding 16 px)
- Segmentlar: `All 69` · `Driving 28` · `Idle 9`
- Ro'yxat elementi (74 px, chapda 3 px status nuqta, bosilganda `--primary-soft`):
  - 1-qator: `Unit #101` (600) + duty badge; o'ngda `0 mph` (600)
  - 2-qator: `John Smith`; o'ngda nisbiy vaqt `2 min`
  - 3-qator: `0.64 mi N of Florence, KY` (muted)
  - ELD offline bo'lsa: tezlik o'rniga `—`, badge `ELD offline`

#### Xarita
- Yuqori chapda qatlam segmentlari: **`Vehicles`** (faol — qora fon, oq matn) ·
  `Trips` · `Geofences` · `Traffic`
- O'ng pastda zoom `+` / `−` (36 px, oq, `--shadow-card`)
- Marker va klaster — W-01 dagidek
- Tanlangan unit o'ng yuqorida **detal kartochkasi** (280 px, `--shadow-pop`):
  - `Unit #101 · Cascadia` + `X`
  - `John Smith · +1 334 765 4888` (muted)
  - Qatorlar (label chapda muted, qiymat o'ngda 600):
    `Duty status` → `On duty` (danger) · `Speed / Odometer` → `0 mph · 993,589 mi` ·
    `Location` → `0.64 mi N of Florence, KY` · `Drive time left` → `00:00:00` (danger) ·
    `Shift ends in` → `00:19:34` (danger) · `ELD` → `PT30_A86E · Connected` (success)
  - Tugmalar: **`View logs`** (primary) + **`Message`** (secondary)

**Rol farqlari:**

| Rol | Kartochka tugmalari |
|---|---|
| ADMIN / FM / DISPATCHER | `View logs` + `Message` |
| **VIEWER** | faqat **`View logs`** (to'liq kenglik) — `messaging = NONE` |

**Amallar:** `Geofences` qatlami yoqilganda xaritada poligon/doira ko'rinadi; `liveFleet=FULL`
bo'lsa xarita ustida `+ New geofence` tugmasi → **Create a geofence** modali (11.1).

**Ma'lumot:**
⚠️ **`GET /live/fleet` endpointi backendda YO'Q** (D-044 tasdiqlaydi). v1 da:
`GET /vehicles?limit=200` + har bir unit uchun oxirgi telemetriya. Bu **N+1** va sekin.
**20-bo'limda `GET /live/fleet` talab qilinadi** — u kelguncha vaqtinchalik yechim:
`GET /vehicles` + `GET /vehicles/:id/telemetry?limit=1` faqat **ko'rinib turgan** unitlar
uchun (ro'yxatdagi birinchi 20 ta + tanlangan).

**Real-time:** `fleet` + tanlangan unit uchun `vehicle:{id}`. 30 s polling
(`fleet.position` yo'q). `Refreshed N seconds ago` — oxirgi muvaffaqiyatli fetch vaqti.

**Holatlar:** xarita yuklanmasa — `<ErrorState>` `Map could not be loaded` + `Retry`,
ro'yxat baribir ishlaydi · GPS yo'q unitlar xaritada emas, ro'yxatda `—` bilan.

**Qabul mezoni:** ⬜ 4 qatlam segmenti · ⬜ klaster · ⬜ kartochka 6 qatori aynan ·
⬜ Viewer'da `Message` yo'q · ⬜ ro'yxat va xarita tanlovi sinxron · ⬜ qidiruv unit/driver/plate bo'yicha
---

### W-03 · Vehicles
**📐 `*/Unit inventory — ELD serial, VIN, odometer.jpg`**
Route `/vehicles` · Perm `vehicles` READ

**Header:** `Vehicles` · `69 units · 62 active · 7 inactive`

**Boshqaruv qatori:**
- Segmentlar: `All 69` · `Active 62` · `Inactive 7` · `Unassigned 4`
- O'ngda: qidiruv `Search unit #, VIN, plate…` · `Status ▾` · `Filters` · `Export` ·
  **`+ Add vehicle`** (primary)

**Jadval** (`GET /vehicles?page&limit&sort&q&status`):

| Ustun | Tarkib | Sort |
|---|---|---|
| ☐ | Tanlash — faqat `FULL` | — |
| `UNIT #` | `#101` (600) | ✅ `unitNumber` |
| `STATUS` | Duty/unit badge: `On-duty`, `Driving`, `ELD offline`, `Idle`, `Yard move`, `Sleeper`, `Inactive` | ✅ |
| `DRIVER` | Avatar + ism · yoki `Unassigned` (muted) | ✅ |
| `MAKE & MODEL` | `Freightliner Cascadia` | ✅ |
| `YEAR` | `2021` | ✅ |
| `VIN` | `1FUJGLDR8LLLL1234` — `--text-secondary`, monospace **emas** | — |
| `ELD SERIAL` | `PT30_A86E` · yoki `Not assigned` (muted) · nofaol qurilma muted (`PT30_9F88`) | — |
| `ODOMETER` | `993,589 mi`, **o'ngga** | ✅ |
| `…` | Qator menyusi — faqat `FULL` | — |

Pagination: `Rows per page: 10` · `1–9 of 69 vehicles`.

**Qator menyusi (`FULL`):** `View unit profile` · `Open HOS logs` · `Track on map` ·
`Assign driver` · `Calibrate odometer` · `View histories` — ajratkich — `Edit unit` ·
`Delete unit` (danger).

**Bulk bar (≥1 tanlangan):** `N vehicles selected` · `Assign driver` · `Export` ·
`Set inactive` · `X`.

**Amallar:**

| Amal | Modal | Endpoint |
|---|---|---|
| `+ Add vehicle` | 11.2 | `POST /vehicles` |
| `Edit unit` | 11.2 (edit rejimi) | `PATCH /vehicles/:id` |
| `Delete unit` | 11.3 | `DELETE /vehicles/:id` |
| `Assign driver` | 11.4 | `POST /vehicles/:id/assign-driver` |
| `Calibrate odometer` | 11.5 | `POST /vehicles/:id/calibrate-odometer` |
| `Import` (menyudan) | 11.6 | `POST /vehicles/import` |
| `Export` | — | `GET /vehicles/export` → CSV yuklab olish |
| `Filters` | 11.23 | query parametrlari |
| Ustunlar | 11.24 | localStorage |

> ⚠️ Dizaynda Vehicles boshqaruv qatorida `Import` tugmasi **yo'q** (Drivers'da bor), lekin
> `Import vehicles` modali chizilgan va `POST /vehicles/import` mavjud. Yechim: `Import`
> **`Export` yonidagi `…` menyusiga** joylanadi (`Import from CSV`). Yangi tugma qo'shilmaydi.

**Rol farqlari:**

| Element | ADMIN | FM | DISPATCHER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| ☐ ustuni | ✅ | ✅ | ❌ | ❌ |
| `…` ustuni | ✅ | ✅ | ❌ | ❌ |
| `+ Add vehicle` | ✅ | ✅ | ❌ | ❌ |
| `Export` | ✅ | ✅ | ✅ | ✅ |
| `Filters` / `Status` / qidiruv | ✅ | ✅ | ✅ | ✅ |

**Qabul mezoni:** ⬜ 9 ustun aynan · ⬜ read-only rollarda ikkala xizmat ustuni ham yo'q ·
⬜ `Not assigned` muted · ⬜ odometr o'ngga va tabular · ⬜ sort server tomonda ·
⬜ qidiruv debounce 300 ms · ⬜ filtr URL query'ga yoziladi (shareable)

---

### W-04 · Unit profile
**📐 `*/Unit profile — telemetry, details, activity log.jpg`**
Route `/vehicles/:id` · Perm `vehicles` READ

**Header:** `Unit #101` · breadcrumb `Vehicles › Unit #101 · Freightliner Cascadia 2021`.
O'ngda **`Edit unit`** (secondary, `Pencil`) — faqat `vehicles` FULL.

#### Identifikatsiya paneli (karta, to'liq kenglik)
- Chapda 56 px `--primary-soft` plitka + `Truck`
- `Unit #101` (22/600) + yonida badge'lar: `● On duty` (danger) · `● BLE connected` (info) ·
  `Service due in 3,100 mi` (warning) · `● 2 active DTCs` (warning)
- Ostida muted qator: `Freightliner Cascadia 2021 · VIN 1FUJGLDR8LLLL1234 · Plate OH 4821-JG · Diesel`
- O'ngda: `View logs` · `Track on map` · **`Assign driver`** (primary, `UserPlus`) · `…`

#### Tab'lar
`Overview` (default) · `Diagnostics` · `Trips` · `DVIR` · `Documents` · `Activity`
— pill segment, faol oq karta. URL: `?tab=diagnostics`.

#### Overview — chap ustun (1fr)

**`Live status` kartasi**
- Header: `Live status` + `Updated 2 minutes ago`; o'ngda **`Calibrate odometer`**
  (secondary — faqat `vehicles` FULL) + `● 0 mph` chip
- Mini-xarita 100 px, markazda unit markeri
- 2×4 telemetriya gridi (label 12 muted + ikonka, qiymat 18/600):

| | | | |
|---|---|---|---|
| `Odometer` **993,589 mi** *(ostida caption `ECU 981,109 + offset 12,480`)* | `Engine hours` **1,070 h 12 m** | `Fuel level` **78%** | `Coolant temp` **79 °C** ⚠️ |
| `Oil level` **92%** | `Battery` **13.9 V** | `DEF level` **61%** | `Bus type` **J1939 / J1708** |

> `ECU + offset` caption — `backend/tz.md` §4.3 odometr offseti. `deviceOdometerMi` va
> `odometerOffsetMi` dan hisoblanadi va **doim ko'rsatiladi** (auditor uchun muhim).
> Coolant temp ikonkasi `> 100 °C` da `--danger` bo'ladi.

**`Upcoming maintenance` kartasi**
- Header + `2 services scheduled`; o'ngda **`+ New work order`** (`maintenance` FULL)
- 2 ustunli grid, har biri: `🔧 Brake service` + `Due in 3,100 mi · Sep 24` + progress bar
  (3.5-qoidasi bo'yicha rang)
- Manba: `GET /maintenance-schedules?vehicleId=`

**`Unit activity` kartasi**
- Header + `Last 30 days`; o'ngda `Export`
- Jadval: `TIME STAMP` · `ACTIVITY` · `DRIVER` · `SOURCE` · `DETAILS`
  - `Sep 10, 05:30` · `Duty status changed to Driving` · `JS John Smith` · `ELD · automatic` · `Odometer 993,109 mi`
  - `Sep 10, 05:12` · `Pre-trip DVIR submitted · no defects` · `JS John Smith` · `Mobile app v2.24` · `DVIR #88214`
- `SOURCE` qiymatlari: `ELD · automatic` (muted) · `Mobile app v2.24` · `Driver · edited` (warning) · `Web · <user>`
- ⚠️ **`GET /vehicles/:id/activities` backendda yo'q** → 20-bo'lim

#### Overview — o'ng ustun (348 px)

**`Unit details` kartasi** — header + **`Edit`** (`Pencil`, `vehicles` FULL).
Qatorlar (label muted chapda, qiymat 600 o'ngda), aynan shu tartibda:
`Unit number` `#101` · `ELD device` `PT30_A86E` · `Activated on` `Apr 18, 2025` ·
`VIN` `1FUJGLDR8LLLL1234` · `Make / model` `Freightliner Cascadia` · `Year` `2021` ·
`License plate` `OH 4821-JG` · `Issuing state` `Ohio` · `Fuel type` `Diesel` ·
`Sleeper berth` `Available` · `Primary driver` `John Smith` · `Co-driver` `Marcus Webb`

> `Co-driver` — `GET /co-driver-pairings?vehicleId=&active=true` dan. ⚠️ Endpoint yo'q → 20-bo'lim.
> Yo'q bo'lsa `—`.

#### Boshqa tab'lar

| Tab | Tarkib | Endpoint |
|---|---|---|
| `Diagnostics` | Faol DTC jadvali: `SPN` · `FMI` · `DESCRIPTION` · `SOURCE` · `OCCURRENCES` · `FIRST SEEN` · `LAST SEEN` · `STATUS`. Yuqorida `Active 2` / `Cleared` segmentlari | `GET /vehicles/:id/dtc` |
| `Trips` | Trip jadvali (W-08 ustunlari), unit bo'yicha filtrlangan | `GET /trips?vehicleId=` |
| `DVIR` | DVIR jadvali (W-09), unit bo'yicha | `GET /dvir?vehicleId=` |
| `Documents` | Fayl kartalari (registratsiya, sug'urta, IFTA stikeri) + `Upload`. ⚠️ **Backendda yo'q** → 20-bo'lim. v1 da tab **`Soon` chipi bilan disabled** |
| `Activity` | `Unit activity` jadvalining to'liq, pagination bilan versiyasi | ↑ |

**Rol farqlari:** DISPATCHER va VIEWER'da `Edit unit`, `Calibrate odometer`, `New work order`,
`Edit` (details) **yo'q**. `Assign driver`: ADMIN/FM/**DISPATCHER**'da bor, VIEWER'da yo'q.

> ⚠️ **Nomuvofiqlik:** dizayn dispetcherga `Assign driver` beradi, `backend/tz.md` §6.4 esa
> `vehicles = READ`. Yechim 21.3-bo'limda: endpoint `vehicles:FULL` **yoki** `trips:FULL`
> talab qilsin (backend o'zgarishi). U bajarilmaguncha dispetcherda tugma ko'rinadi, lekin
> `403` qaytsa toast: `You do not have permission to assign drivers.`

**Real-time:** `vehicle:{id}` — `telemetry.point` (Live status invalidate, 200 ms throttle),
`device.ble_state` (badge), `eld.events_ingested` (activity).

**Qabul mezoni:** ⬜ 4 badge · ⬜ 8 telemetriya katakchasi · ⬜ ECU caption · ⬜ 12 qatorli
`Unit details` · ⬜ Documents disabled+Soon · ⬜ read-only rollarda 4 ta tugma yo'q

---

### W-05 · Unit histories (route replay)
**📐 `*/Route replay, drive : stop : idle segments.jpg`**
Route `/vehicles/:id/histories?date=` · Perm `vehicles` READ

**Header:** `Unit #101 · Histories` · breadcrumb
`Vehicles › Unit #101 › Histories · Wed, Sep 10, 2025 · Eastern`

**Boshqaruv:** `🚚 Unit #101 · Freightliner Cascadia ▾` · `‹ 📅 Wed, Sep 10, 2025 ›` ·
o'ngda segment filtri `All 18` · `Drive 7` · `Stop 6` · `Idle 5` · `Export`

**KPI ×4:** `Distance travelled` **482 mi** + `7 drive segments` · `Drive time` **11:26** +
`avg 42 mph` · `Stops` **6** + `total 04:18` · `Idle time` **01:12** + warning chip `2.4 gal wasted`

**`Route replay` kartasi (1fr):** header + `Sep 10 · 02:30 → 14:26 · 482 mi`; o'ngda `▶ Play`.
Xarita 240 px: ko'k marshrut chizig'i (3 px), nuqtalar `A B C D` (harfli doiralar, rangi tur
bo'yicha: Drive=success, Stop=danger, Idle=warning, End=danger). Chap yuqorida legend
`● Start ● Stop ● End`. `Play` — vaqt bo'yicha animatsiya (1× / 2× / 4×, pastda slayder).

**`Day summary` kartasi (348 px):** header + `From the ELD event stream`; qatorlar:
`First movement` `02:30:44` · `Last movement` `14:26:12` · `Engine on time` `13h 41m` ·
`Engine off time` `10h 19m` · `Longest drive` `Harrisburg → Florence, KY — 05h 56m` ·
`Longest stop` `Harrisburg, OH — 00:30` · `Max speed` `63 mph at 11:12`

**`Movement segments` jadvali:** header + `18 segments today · drive, stop and idle`;
o'ngda `View on map`.
Ustunlar: harfli marker · `TYPE` (badge `Drive`/`Stop`/`Idle`) · `START` · `END` ·
`DURATION` (`05h 30m`) · `LOCATION` (`Columbus, OH → 1.04 mi W of Harrisburg, OH`) ·
`DISTANCE` (o'ngga, harakatsizda `—`) · `ODOMETER` · `DRIVER`.
Qator hover — xaritadagi mos segment yoritiladi.

**Ma'lumot:** ⚠️ **`GET /vehicles/:id/histories?date=` backendda yo'q** → 20-bo'lim.
Vaqtinchalik: `GET /vehicles/:id/telemetry?from&to` + `GET /logs/:driverId/events` dan
frontendda segmentlash — **lekin bu 60 000 nuqtani brauzerga tortadi va qabul qilinmaydi**.
Shuning uchun bu ekran **backend endpointisiz relizga chiqmaydi** (12-bosqich shartida).

**Qabul mezoni:** ⬜ 4 KPI · ⬜ Day summary 7 qatori · ⬜ segment jadvali va xarita bog'langan ·
⬜ Play ishlaydi · ⬜ sana navigatsiyasi URL'ga yoziladi
---

### W-06 · Drivers
**📐 `*/Driver roster with live HOS clocks and violations.jpg`**
Route `/drivers` · Perm `drivers` READ

**Header:** `Drivers` · `58 drivers · 42 on duty · 6 with active violations`

**Boshqaruv:** segmentlar `All 58` · `On duty 42` · `Off duty 16` · `Violations 6` ·
o'ngda qidiruv `Search driver, username…` · `Terminal ▾` · `Filters` · **`Import`** ·
`Export` · **`+ Add driver`**

**Jadval** (`GET /drivers?...`):

| Ustun | Tarkib |
|---|---|
| ☐ | `FULL` da |
| `DRIVER` | Avatar + ism (600); ostida `@johnsmith · v2.24` (12 muted). **Email tasdiqlanmagan bo'lsa** (prod) ism yonida kichik `● Email not verified` chipi |
| `STATUS` | Duty badge (`On-duty`, `Driving`, `Off-duty`, `Sleeper`) |
| `UNIT` | `#101` yoki `—` |
| `DRIVE LEFT · 11H` | `<HosMeter>` — `00:00` (danger) / `05:48` (success) |
| `SHIFT LEFT · 14H` | `<HosMeter>` |
| `CYCLE LEFT · 70H` | `<HosMeter>` |
| `VIOLATIONS` | Badge `1 open` (danger-soft) / `2 open` / `None` (success-soft) |
| `HOME TERMINAL` | `Columbus, OH` (`--text-secondary`) |
| — | **`Logs`** tugmasi (ghost) → `/hos-logs?driverId=` |
| `…` | `FULL` da |

Pagination: `1–9 of 58 drivers`.

**Qator menyusi (📐 `modals/DVIRs, open defects, preventive maintenance.jpg`) — aynan:**
```
View driver profile
Open HOS logs
Send message                    ← faqat messaging ≠ NONE
Assign trip                     ← faqat trips = FULL
────────── COMPLIANCE ──────────
Request log edit                ← faqat hosEdit = FULL
Certify on behalf               ← faqat hosCertifyOnBehalf = FULL (ADMIN)
Export 8-day RODS
──────────────────────────────
Reset app password              ← drivers = FULL
Deactivate driver  (danger)     ← drivers = FULL
```

**Bulk bar:** `3 drivers selected` · `Assign unit` · `Send message` · `Export logs` ·
`Deactivate` · `X`.

**⚠️ Ma'lumot muammosi:** `GET /drivers` faqat `Driver` qatorini qaytaradi — HOS soatlari,
buzilishlar soni va joriy duty status **yo'q** (`drivers.service.ts` → `toView`).
Ekran ularsiz chizilmaydi.

**Yechim (20-bo'limda talab):** `GET /drivers?include=hos` yoki yangi
`GET /drivers/roster` — har bir qator uchun:
```json
{ "driver": {...}, "dutyStatus": "ON", "unit": { "id": "...", "unitNumber": "#101" },
  "hos": { "driveRemainingSec": 0, "shiftRemainingSec": 1140, "cycleRemainingSec": 46140 },
  "openViolations": 1 }
```
U kelguncha **ekran relizga chiqmaydi** (58 ta drayver uchun 58 ta so'rov qabul qilinmaydi).

**Rol farqlari:**

| Element | ADMIN | FM | DISPATCHER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| ☐ va `…` | ✅ | ✅ | ❌ | ❌ |
| `Import`, `+ Add driver` | ✅ | ✅ | ❌ | ❌ |
| `Terminal ▾`, `Filters`, `Export` | ✅ | ✅ | ✅ | ✅ |
| `Logs` tugmasi | ✅ | ✅ | ✅ | ✅ |

**Qabul mezoni:** ⬜ 3 HOS ustuni rangi qoidaga mos · ⬜ `@username · v2.24` ikkinchi qator ·
⬜ menyu 3 guruhi va ruxsat filtri · ⬜ read-only rollarda xizmat ustunlari yo'q

---

### W-07 · Driver profile
**📐 `*/Driver profile — HOS clocks, violations, logs.jpg`**
Route `/drivers/:id` · Perm `drivers` READ

**Header:** `John Smith` · breadcrumb `Drivers › John Smith · @johnsmith · Unit #101`.
O'ngda **`Edit driver`** (`drivers` FULL).

**Identifikatsiya paneli:** 56 px avatar `JS`; `John Smith` (22/600) + badge'lar
`● On duty` · `● 1 violation · 1 warning` (danger) · `Uncertified · 2 days` (warning);
muted qator `Unit #101 · CDL OH-W8569238 · Columbus, OH terminal · smith@gmail.com · +1 334 765 4888`.
O'ngda: `Message` · `View logs` · **`Assign trip`** (primary) · `…`

**Tab'lar:** `Overview` · `HOS & logs` · `DVIRs` · `Trips` · `Documents` · `Activity`

#### Overview — chap (1fr)

**`Hours of service · right now`** — header + `Property-carrying · 70 hr / 8 day cycle`;
o'ngda chip `● On duty since 14:26`.
4 ta ichki karta (`--border`, `--radius-md`, padding 14 px), har birida label, qiymat, meter:

| Karta | Qiymat | Yon matn |
|---|---|---|
| `Drive left` | `00:00` (danger) | `limit exceeded` |
| `Shift left` | `00:19` (danger) | `of 14:00` |
| `Cycle left` | `12:49` (warning) | `of 70:00` |
| `Break in` | `02:04` (success) | `of 08:00 driving` |

**`Violations & alerts`** — header + `Last 8 days`; o'ngda `View all ›`.
Ustunlar: `DATE` (`Sep 10`) · `VIOLATION` (`11-hour driving limit`) ·
`DETAIL` (`Exceeded by 00:26 at 14:26`) · `STATUS` (`Open` danger / `Warning` / `Resolved` success).

**`Recent daily logs`** — header + `Last 8 days available`; o'ngda `Open HOS logs ›`.
Ustunlar: `DATE` (`Wed, Sep 10` — 600) ·
`DUTY TOTALS (OFF / SB / D / ON)` (`07:30 · 02:00 · 11:26 · 03:04`) · `DISTANCE` (`482 mi`) ·
`VIOLATIONS` (`1 open` / `None`) · `CERTIFICATION` (`Uncertified` warning / `Certified` success) ·
**`View graph grid`** tugmasi → `/hos-logs?driverId=&date=`.
Manba: `GET /logs/:driverId/range?from&to` (`days[].summary`).

#### Overview — o'ng (348 px)

**`Driver profile`** — header + `Edit` (`drivers` FULL). Qatorlar:
`Username` `johnsmith` · `Email` (**Gmail — kirish identifikatori**; prod'da tasdiqlanmagan
bo'lsa yonida `● Not verified` + `Send verification` linki) · `Phone` ·
`CDL number` `W8569238` · `CDL state` `Ohio` ·
`Home terminal` `Columbus, OH` · `Fleet manager` `Sarah Chen` · `Co-driver` `Marcus Webb` ·
`Assigned unit` `#101` · `App version` `v2.24 · Android` · `Registered on` `Apr 18, 2025` ·
`Exemptions` `Personal conveyance, Yard move`

> `Exemptions` — yoqilgan bayroqlar vergul bilan: `Personal conveyance`, `Yard move`,
> `Adverse driving`, `Short-haul (150 air-mile)`, `Split sleeper`, `ELD exempt`.
> Hech biri yo'q bo'lsa `None`.

**Rol farqlari:**

| Element | ADMIN | FM | DISPATCHER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| `Edit driver` (header) | ✅ | ✅ | ❌ | ❌ |
| `Edit` (profil kartasi) | ✅ | ✅ | ❌ | ❌ |
| `Message` | ✅ | ✅ | ✅ | ❌ |
| `Assign trip` | ✅ | ✅ | ✅ | ❌ |
| `View logs` | ✅ | ✅ | ✅ | ✅ |
| `…` menyusi | ✅ | ✅ | ⚠️ bo'sh — **ko'rsatilmaydi** | ❌ |

> Dizaynda dispetcher/viewer'da `…` o'rnida bo'sh tugma ko'rinadi — bu **mock artefakti**.
> To'g'ri xatti-harakat: menyuda hech qanday punkt qolmasa, tugma **render qilinmaydi**.

**Ma'lumot:** `GET /drivers/:id` + `GET /logs/:driverId/range` + buzilishlar.
⚠️ **Joriy HOS holati uchun endpoint yo'q** (`GET /drivers/:id/hos` tz.md'da bor, kodda yo'q)
→ 20-bo'lim. Ular kelguncha `Hours of service · right now` kartasi **skeleton** holatida.

**Real-time:** `driver:{id}`.

**Qabul mezoni:** ⬜ 3 badge · ⬜ 4 HOS kartasi · ⬜ 12 qatorli profil · ⬜ `View graph grid`
to'g'ri sanaga o'tadi · ⬜ bo'sh `…` render qilinmaydi
---

### W-08 · HOS Logs · Driver log ⭐
**📐 `*/24-hour ELD graph grid, available hours, certification.jpg`**
Route `/hos-logs?driverId=&date=` · Perm `hos` READ

Bu **muvofiqlik yadrosi**. Inspektor shu ekranni ko'radi.

**Header:** `Hours of Service · Driver log` ·
subtitle `John Smith · Unit #101 · Home terminal: Columbus, OH (Eastern)`

**Boshqaruv qatori:**
- Chapda: `<DriverPicker>` `JS John Smith ▾` · sana navigatori `‹ 📅 Wed, Sep 10, 2025 ›` ·
  sertifikatsiya chipi `● Uncertified` (warning) yoki `● Certified` (success)
- O'ngda: **`+ Add / edit event`** (`hosEdit` FULL) · **`Export PDF`** · **`Send to inspector`**
  (primary, `reportsTransfer` FULL)

#### `24-hour graph grid` kartasi ⭐

Header: `24-hour graph grid` + `Recorded by ELD PT30_A86E · all times Eastern`;
o'ngda chip `● No unassigned segments` (success) yoki `● 9 unassigned segments` (warning,
bosilganda 11.13 modali).

**Grid spetsifikatsiyasi (o'z SVG komponentimiz):**

```
        M  1  2  3  4  5  6  7  8  9 10 11  N  1  2  3  4  5  6  7  8  9 10 11  M     TOTAL
OFF    ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐     07:30
Off duty                          ▔▔▔▔                              ▔▔▔▔▔▔▔▔▔▔▔
SB     ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤     02:00
Sleeper ▔▔▔▔▔
D      ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤     11:26
Driving      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
ON     ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤     03:04
On duty  ▔▔                                        ▔▔▔▔▔▔▔▔▔
       └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
```

| Element | Spetsifikatsiya |
|---|---|
| Chap ustun | 4 qator: `OFF`/`Off duty`, `SB`/`Sleeper`, `D`/`Driving`, `ON`/`On duty`. Katta harf 12/600, ostidagi izoh 10/400 muted |
| Vaqt o'qi | 24 ustun; yorliqlar `M 1 2 … 11 N 1 2 … 11 M` (M=midnight, N=noon), 10/500 muted |
| Panjara | Har soat vertikal 1 px `--border`; har **15 daqiqada** kichik tik chiziq (4 px) |
| Qator foni | `D` qatori juda och yashil (`--success-soft` 40%) — dizaynda shunday |
| Status chizig'i | 2.5 px, rangi 3.1-jadvali bo'yicha; status o'zgarganda **vertikal ulanish chizig'i** |
| Buzilish belgisi | Buzilish sodir bo'lgan intervalda **qizil punktir vertikal chiziq** + ustida och qizil fon (dizaynda 14:26 atrofida) |
| PC / YM | Chiziq **punktir** (dash 4 2), status qatori o'zgarmaydi (PC→OFF, YM→ON) |
| Unassigned segment | Kulrang shtrixli blok |
| O'ng ustun | `TOTAL` sarlavhasi + 4 ta jami: `07:30`, `02:00`, **`11:26`** (limit oshgan bo'lsa danger), `03:04` |
| Hover | Vertikal ko'rsatkich + tooltip: `08:00 – 08:30 · Off duty · 30 min · 1.04 mi W of Harrisburg, OH` |
| Bosish | Mos `Log events` qatoriga scroll + yoritish |
| Balandlik | 120 px (4 × 26 px + o'q) |

Manba: `GET /logs/:driverId?date=` → `graph[]` (`{ status, effective, startAt, durationSec }`),
`summary`, `violations[]`, `certification`.

#### Uch karta qatori (`1fr 1fr 1fr`)

**1) `Available hours`** + `Property-carrying · 70 hr / 8 day`
4 qator `<HosMeter>`: `Drive` `00:00` `limit exceeded` · `Shift` `00:19` `of 14:00` ·
`Cycle` `12:49` `of 70:00` · `Break in` `02:04` `of 08:00 driving`

**2) `Violations · today`** + `2 open`; o'ngda **`Resolve`** (`hosEdit` FULL).
Har bir buzilish — rangli blok (`--danger-soft` / `--warning-soft`), chapda ikonka:
`11-hour driving limit` (14/600) + `Exceeded by 00:26 at 14:26` (12 muted)
`14-hour shift limit approaching` + `Shift ends at 16:00 · 00:19 left`
Bo'sh bo'lsa: `● No violations today` (success matn, markazda).

**3) `Certification · last 8 days`** + `6 certified · 2 pending`; o'ngda
**`Certify all`** (primary) — ⚠️ **faqat `hosCertifyOnBehalf` FULL = ADMIN**.
8 ta katak (44×44, `--radius-md`): kun raqami (`03`…`10`) + ostida ikonka
(`✓` success fon `--success-soft`, `⚠` warning fon `--warning-soft`).
Ostida izoh: `Driver signature required for Sep 9 and Sep 10. A reminder was sent to the
mobile app at 16:05.`
Katak bosilganda — o'sha kunga o'tish (`?date=`).
Manba: `GET /logs/:driverId/range?from&to` (8 kun).

#### `Log events` jadvali

Header: `Log events` + `48 events today · 1 driver edit pending review`; o'ngda `View all events ›`.

| Ustun | Tarkib |
|---|---|
| `TIME` | `02:00:12` (600, tabular) |
| `STATUS` | Duty badge |
| `LOCATION` | `Columbus, OH · terminal` |
| `ODOMETER` | `993,107 mi` (o'ngga) |
| `ENGINE HRS` | `1070.2 h` (o'ngga) |
| `ORIGIN` | `ELD · automatic` (muted) · **`Driver · edited`** (warning) · `Carrier · proposed` (info) · `Unidentified` (muted) |
| `NOTES` | `Pre-trip inspection` · `30-min break` · `Loading · shipper #4821` · `—` |
| `…` | `hosEdit` FULL: `Request an edit` · `View full record` · `Copy event ID` |

Manba: `GET /logs/:driverId/events?date=` — **superseded (2), proposed (3) va rejected (4)
yozuvlar ham keladi**. Default ko'rinishda faqat `recordStatus = 1`; yuqorida checkbox
`Show superseded and proposed records` — yoqilganda ular ham chiqadi:
superseded qator **ustidan chizilgan** (`line-through`, muted), proposed — `--info-soft` fon.

> Bu FMCSA talabi: audit izi yashirilmaydi, lekin default ko'rinish chalkashmasligi kerak.

**Rol farqlari (dizayndan aynan):**

| Element | ADMIN | FM | DISPATCHER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| `+ Add / edit event` | ✅ | ✅ | ❌ | ❌ |
| `Export PDF` | ✅ | ✅ | ✅ | ✅ |
| `Send to inspector` | ✅ | ✅ | ❌ | ❌ |
| `Resolve` (violations) | ✅ | ✅ | ❌ | ❌ |
| **`Certify all`** | ✅ | ❌ | ❌ | ❌ |
| Log events `…` | ✅ | ✅ | ❌ | ❌ |
| Unassigned chip bosiladi | ✅ | ✅ | ❌ (faqat ko'rinadi) | ❌ |

**Amallar:**

| Amal | Modal | Endpoint |
|---|---|---|
| `+ Add / edit event` | 11.11 Request a log edit | `POST /logs/:driverId/edit-requests` |
| `Certify all` | 11.12 Certify logs | `POST /logs/:driverId/certify` |
| Unassigned chip | 11.13 Unassigned driving | `POST /unidentified/:id/assign` \| `/annotate` \| `/reject` |
| `Send to inspector` | 11.14 Send logs to a safety official | `POST /transfers` |
| `Export PDF` | — | `POST /reports/generate {type:'ACTIVITY'}` → `report.ready` → yuklab olish |
| `Resolve` | Kichik modal: sabab matni + `Resolve` | ⚠️ `POST /violations/:id/resolve` **yo'q** → 20-bo'lim |

**Real-time:** `driver:{id}`, `violations`. `eld.events_ingested` → `logDay` + `logEvents`
invalidate. Sertifikatsiya/tuzatish hodisalari yo'q → `Certify all` dan keyin qo'lda invalidate.

**Holatlar:** ma'lumot yo'q kun — grid to'liq OFF chizig'i + banner
`No ELD records for this day. The driver may have been off duty or the app was not signed in.` ·
kelajak sana — `‹ ›` o'ng tomoni disabled · drayver tanlanmagan — `<EmptyState>`
`Select a driver to view their log` + `<DriverPicker>`.

**Qabul mezoni:** ⬜ Grid 24 ustun + 4 qator + 15-daqiqalik tiklar · ⬜ TOTAL 4 qiymati ·
⬜ buzilish punktiri · ⬜ PC/YM punktir chiziq · ⬜ hover tooltip · ⬜ `Certify all` faqat
ADMIN'da · ⬜ superseded checkbox · ⬜ barcha vaqtlar **home terminal** mintaqasida ·
⬜ DST kunida 23/25 soat to'g'ri
---

### W-09 · DVIR & Maintenance
**📐 `*/DVIRs, open defects, preventive maintenance.jpg`**
Route `/dvir` · Perm `dvir` READ · **Dispatcher'da yo'q**

**Header:** `DVIR & Maintenance` · `Driver vehicle inspection reports, defects and service schedule`

**Boshqaruv:** segmentlar `DVIRs 312` · `Open defects 14` · `Work orders 7` · `Schedules 22`
(⚠️ oxirgi ikkitasi `maintenance` ruxsatiga bog'liq) · o'ngda qidiruv `Search unit, defect…` ·
`Last 7 days ▾` · `Export` · **`+ New work order`** (`maintenance` FULL)

**KPI ×4:** `Open defects` **14** + danger chip `4 critical` · `Overdue services` **3** +
warning chip `oldest 12 d` · `DVIRs today` **22** + success chip `18 no-defect` ·
`Vehicles out of service` **1** + danger chip `Unit #110`

#### Tab: `DVIRs`

**`Recent DVIRs` (1fr)** — header + `Last 48 hours`; o'ngda `View all ›`.
Ustunlar: `DATE & TIME` (`Sep 10, 05:12`) · `UNIT` · `DRIVER` (avatar+ism) ·
`TYPE` (`Pre-trip`/`Post-trip`/`Intermediate`) · `DEFECTS` (`None` muted / `Brakes, Lights`) ·
`STATUS` (`No defects` success · `Not fixed` danger · `Defects fixed` info) · `…`
Qator bosilganda → **DVIR drawer** (11.15).

**`Upcoming maintenance` (348 px)** — header + `Next 30 days`.
Kartalar: `🔧 Unit #104 · Oil & filter` + `Due in 420 mi · Sep 13` + progress bar
(rangi: muddat yaqin → danger, o'rtacha → warning, uzoq → success).
Manba: `GET /maintenance-schedules?dueWithinDays=30`.

**`Open defects` (to'liq kenglik)** — header + `14 total · 4 critical`; o'ngda
**`+ Create work order`** (`maintenance` FULL).
Ustunlar: `UNIT` · `REPORTED` (`Sep 10, 04:58`, muted) · `COMPONENT` (`Brakes, Service`) ·
`SEVERITY` (`Critical`/`Major`/`Minor`) · `DESCRIPTION` ·
`ASSIGNED TO` (`Mike Rowan · Shop A` / `Unassigned` muted) ·
`STATUS` (`Out of service` danger · `In progress` info · `Open` outline).
Qator bosilganda → **Resolve defect** modali (11.17) (`dvir` FULL) yoki read-only ko'rinish.

#### Boshqa tab'lar

| Tab | Tarkib | Endpoint |
|---|---|---|
| `Open defects` | Yuqoridagi jadvalning to'liq, filtrli versiyasi | `GET /defects?status=OPEN` |
| `Work orders` | `NUMBER` (`WO-2214`) · `UNIT` · `TITLE` · `PRIORITY` · `STATUS` · `VENDOR` · `COST` · `DUE` · `…` (`Close`, `Cancel`, `Edit`) | `GET /work-orders` |
| `Schedules` | `UNIT` · `NAME` · `INTERVAL` (`Every 25,000 mi` / `Every 180 days`) · `LAST SERVICE` · `NEXT DUE` · `STATUS` · `…` (`Complete`, `Edit`, `Delete`) | `GET /maintenance-schedules` |

**Rol farqlari:** VIEWER'da — `+ New work order`, `+ Create work order`, `…` ustunlari,
`Work orders` va `Schedules` tab'lari **yo'q** (`maintenance = READ` bo'lsa tab'lar
ko'rinadi, lekin amalsiz; dizayn viewer'da 4 tab'ni ko'rsatadi — shuning uchun **tab'lar
qoladi, amallar yo'q**). Dispatcher'da butun ekran yo'q.

**Qabul mezoni:** ⬜ 4 KPI · ⬜ 3 blok · ⬜ severity ranglari · ⬜ `Out of service` badge
faqat CRITICAL ochiq defektda · ⬜ drawer ochiladi · ⬜ viewer'da amal tugmalari yo'q

---

### W-10 · Safety
**📐 `*/Harsh driving, speeding, fleet score, scorecard.jpg`**
Route `/safety` · Perm `safety` READ · **Dispatcher'da yo'q**

**Header:** `Safety` · `Harsh driving, speeding and coaching · last 30 days`
**Boshqaruv:** `Events 186` · `Coaching 12` · `Scorecards 58` · o'ngda qidiruv
`Search driver, unit…` · `Last 30 days ▾` · `Export`

**KPI ×4:** `Fleet safety score` **87** + success `↑ 4 pts` · `Harsh events` **42** +
success `↓ 9 vs prev.` · `Speeding events` **31** + **danger** `↑ 6 vs prev.` ·
`Coaching sessions` **12** + warning `5 pending`

**`Safety events` (1fr)** — header + `186 events · 24 need review`; o'ngda `View all ›`.
Ustunlar: `EVENT` (badge `Speeding` danger · `Harsh braking` danger · `Harsh turn` violet ·
`Harsh accel.` warning) · `DRIVER` · `UNIT` · `DATE & TIME` (muted) · `LOCATION` ·
`SEVERITY` (o'ngga: `78 / 65 mph` — tezlik/limit, yoki `-0.42 g`, danger rangda).

**`Fleet safety score` (348 px)** — yarim doira gauge (radius 62, qalinlik 10, `--success`),
markazda `87` (30/600) + `/100`; o'ngda `Good standing` (15/600 success) va
`Fleet ranks in the top 22% of carriers of similar size. 4 drivers are below the 70-point
coaching threshold.`

**`Events by type` (348 px)** — `Last 30 days`; 3 qator: nom + o'ngda son, ostida bar:
`Harsh braking 42` (danger) · `Speeding 31` (danger, qisqaroq) · `Harsh acceleration 24` (warning).

**`Driver scorecard`** — header + `58 drivers ranked`; o'ngda **`Assign coaching`**
(`safety` FULL, `Users` ikonka).
Ustunlar: `RANK` (`#1`) · `DRIVER` · `SCORE` (rangli pill: ≥90 success, 70–89 warning, <70 danger) ·
`HARSH EVENTS` · `SPEEDING` · `MILES DRIVEN` · `TREND` (`↑ 3` success / `↓ 7` danger) ·
`View profile ›`.

Manba: `GET /safety/events`, `GET /safety/scorecard`.
Amallar: `PATCH /safety/events/:id` (status), `POST /safety/coaching`.

**Rol farqlari:** VIEWER'da `Assign coaching` yo'q; qolgani bir xil.

**Qabul mezoni:** ⬜ 4 KPI (2-si "kamayish yaxshi" mantiqi bilan) · ⬜ gauge · ⬜ score pill
ranglari · ⬜ trend ikonkalari · ⬜ viewer'da coaching yo'q

---

### W-11 · Dispatch & Trips
**📐 `*/Active trips, route timeline, unassigned loads.jpg`**
Route `/trips` · Perm `trips` READ · **Viewer'da yo'q**

**Header:** `Dispatch & Trips` · `18 active trips · 4 unassigned loads · on-time 94%`
**Boshqaruv:** `Active 18` · `Scheduled 12` · `Completed 240` · `Unassigned 4` · o'ngda
qidiruv `Search trip, driver, city…` · `This week ▾` · `Filters` · **`+ Create trip`**

**KPI ×4:** `On-time delivery` **94%** + success `↑ 3% vs last wk` · `Active trips` **18** +
info `6 arriving today` · `Running late` **2** + warning `avg 48 min` ·
`Unassigned loads` **4** + warning `needs driver`

**`Active trips` (1fr)** — header + `18 trips in progress`; o'ngda `View all ›`.
Ustunlar: `TRIP` (`TR-4821` — **`--primary`, link**) ·
`DRIVER / UNIT` (ikki qator: ism + `Unit #101` muted) ·
`ROUTE` (ikki qator: `Columbus, OH` + `→ Florence, KY` muted) · `DEPART` (`05:30`) ·
`ETA` (`17:40` 600; kechikkanda **danger**) ·
`STATUS` (`On time` success · `Late` danger · `Loading` warning).
Qator tanlanganda o'ngdagi `Route` kartasi shu reysga o'zgaradi.

**`Route · TR-4821` (348 px)** — subtitle `Columbus, OH → Florence, KY`; xarita 130 px;
ostida vertikal timeline (nuqta + chiziq):
`● Pickup` / `Columbus, OH · Shipper #4821` / `05:30 · departed` (success) ·
`● Fuel stop` / `Pilot #482, Cincinnati, OH` / `09:12 · completed` (success) ·
`● Delivery` / `Florence, KY · Major Retail Co.` / `17:40 · ETA` (info).

**`Unassigned loads`** — header + `4 loads waiting for a driver`; o'ngda
**`Auto-assign`** (secondary, `Users`).
Ustunlar: `LOAD` (`LD-9912` 600) · `PICKUP` (`Toledo, OH · Shipper Co.`) · `DELIVERY` ·
`PICKUP WINDOW` (`Sep 11, 06:00 – 10:00`) · `WEIGHT` (`21,300 lbs`) ·
**`Assign driver`** (primary tugma har qatorda).

**Amallar:** `+ Create trip` → 11.10 · `Assign driver` → 11.4 variantı (load uchun) ·
`Auto-assign` → `POST /trips/auto-assign`, natijada toast
`3 loads assigned · 1 skipped (no driver with enough hours)`.
Manba: `GET /trips`, `GET /trips/unassigned-loads`.

**Rol farqlari:** ADMIN/FM/DISPATCHER — bir xil (dispetcherda `trips = FULL`).

**Real-time:** `fleet` → `trip.status_changed` qatorni va KPI'ni yangilaydi.

**Qabul mezoni:** ⬜ 4 KPI · ⬜ trip tanlash timeline'ni yangilaydi · ⬜ `Late` qizil ETA ·
⬜ `Auto-assign` natijasi toast'da · ⬜ viewer route'ga kira olmaydi (403)
---

### W-12 · Reports · IFTA
**📐 `*/IFTA by jurisdiction and the report library.jpg`**
Route `/reports/ifta` · Perm `reports` READ

**Header:** `Reports · IFTA` · `Q3 2025 · Jul 1 – Sep 30 · 69 units`
**Boshqaruv:** `IFTA mileage report ▾` (hisobot tanlagich) · `Q3 2025 ▾` ·
`All jurisdictions ▾` · `All vehicle groups ▾` · o'ngda `Export CSV` ·
**`Generate report`** (primary, `reports` FULL)

**KPI ×4:** `Total miles` **428,914** + `Q3 to date` · `Taxable miles` **401,220** +
success `93.5%` · `Fuel purchased` **62,410 gal** + `1,842 receipts` ·
`Fleet MPG` **6.4** + success `↑ 0.2 vs Q2`

**`Miles by jurisdiction` (1fr)** — header + `Q3 2025 · IFTA-ready`; o'ngda
`Download IFTA PDF` (secondary, `reports` FULL).
Ustunlar: `JURISDICTION` (`Ohio`, `Ontario (CA)`) · `TOTAL MILES` · `TAXABLE MILES` ·
`FUEL (GAL)` · `MPG` · `TAX DUE` (`$2,184.30`) — **hammasi o'ngga, tabular**.
Oxirgi qator sifatida **jami** (600, `--bg-subtle` fon).

**`Report library` (348 px)** — 6 ta bosiladigan qator (ikonka + nom + tavsif + `›`):
`IFTA mileage report` / `Quarterly fuel tax by jurisdiction` ·
`FMCSA / DOT audit pack` / `Logs, DVIRs and unassigned driving` ·
`Activity report` / `Duty status totals per driver` ·
`DVIR report` / `Inspections and defect history` ·
`Driver logs (RODS)` / `Printable 8-day log sheets` ·
`Idle & fuel report` / `Idle time, fuel burn and MPG`

> `Driver logs (RODS)` va `Idle & fuel report` uchun backend `ReportType` **yo'q**
> (`IFTA | ACTIVITY | DVIR | FMCSA_PACK | UNIDENTIFIED | SAFETY`). v1 da:
> `Driver logs (RODS)` → `ACTIVITY` (PDF) ga yo'naltiriladi; **`Idle & fuel report`
> disabled + `Soon` chipi**. 20-bo'limda talab sifatida yozilgan.

**`Recently generated`** — header + `Kept for 24 months`; o'ngda
**`Schedule a report`** (secondary, `reports` FULL, `Calendar`).
Ustunlar: `REPORT` · `PERIOD` · `GENERATED BY` · `CREATED` (`Jul 03, 2025 09:12`) ·
`FORMAT` (`PDF · CSV`, `ZIP`) · `STATUS` (`Ready` success · `Queued` muted ·
`Running` info + spinner · `Failed` danger) · yuklab olish ikonkasi.
Manba: `GET /reports?page&limit`. `QUEUED`/`RUNNING` bo'lsa **3 s polling**.

**Rol farqlari:** VIEWER'da `Generate report`, `Schedule a report` **yo'q**
(`Export CSV` va `Download IFTA PDF` qoladi).

---

### W-13 · Reports · Activity
**📐 `*/Reports — duty totals and distance by driver.jpg`** · Route `/reports/activity`

**Header:** `Reports · Activity report` · `Sep 01 – Sep 10, 2025 · 58 drivers · duty totals and distance`
**Boshqaruv:** `Activity report ▾` · `<DateRangePicker>` · `All terminals ▾` ·
`Group by driver ▾` · o'ngda **`Schedule`** (`reports` FULL) · `Export CSV` · `Print`

**KPI ×4:** `Total driving` **4,182 h** + success `↑ 6% vs prev.` · `Total on-duty` **1,046 h** +
`20% of total` · `Distance driven` **262,418 mi** + `452 mi/day` · `Violations` **31** +
success `↓ 8 vs prev.`

**`Duty totals by driver`** — header + `Totals are calculated from certified and uncertified
logs`; o'ngda chip `58 drivers · showing 8`.
Ustunlar: `DRIVER` · `DAYS` · `OFF` · `SB` (`--violet`) · **`DRIVING`** (`--success`, 600) ·
`ON` (`--danger`) · `DISTANCE` · `VIOLATIONS` (pill `2` danger / `None` success) ·
`CERTIFIED` (`8 / 10` — to'liq bo'lmasa `--warning`, to'liq bo'lsa `--success`) ·
`Open logs ›`.
Pagination: `1–8 of 58 drivers`.

**Rol farqlari:** DISPATCHER va VIEWER'da `Schedule` **yo'q**.

---

### W-14 · Reports · DVIR
**📐 `*/Reports — inspection and defect history.jpg`** · Route `/reports/dvir` · Perm `reports` READ (+ `dvir`)

**Header:** `Reports · DVIR report` · `Sep 01 – Sep 10, 2025 · 312 inspections · 14 with defects`
**Boshqaruv:** `DVIR report ▾` · date range · `All units ▾` · `All defect types ▾` ·
o'ngda `Schedule` (`reports` FULL) · `Export CSV` · **`Download PDF`** (primary)

**KPI ×4:** `Inspections submitted` **312** + success `98% compliance` · `With defects` **14** +
danger `4 critical` · `Average time to fix` **1.8 days** + success `↓ 0.4 d` ·
`Missing pre-trip` **3** + danger `3 drivers`

**`Inspection reports`** — header + `Driver and mechanic signatures are attached to every
record`; o'ngda chip `312 records · showing 8`.
Ustunlar: `DATE & TIME` (topshirilmagan bo'lsa `Sep 07, —`) · `UNIT` · `DRIVER` · `TYPE` ·
`DEFECTS` (`Brakes · Lights (Head - Stop)` / `None` muted / **`Not submitted`** warning) ·
`SEVERITY` (`Critical`/`Major`/`—`) · `CORRECTED BY` (`Mike Rowan · Shop A` / `Unassigned`
warning / `—`) · `STATUS` (`No defects` · `Not fixed` · `Fixed` · **`Missing`** warning).

**Rol farqlari:** VIEWER'da `Schedule` yo'q, `Export CSV` va `Download PDF` bor.
Dispatcher'da butun ekran yo'q (`dvir` menyusi yopiq).

---

### W-15 · Reports · FMCSA / DOT audit pack ⭐
**📐 `*/Reports — FMCSA : DOT pack and eRODS transfer.jpg`**
Route `/reports/fmcsa` · Perm `reportsTransfer` READ · **faqat ADMIN va FLEET_MANAGER**

**Header:** `Reports · FMCSA / DOT audit pack` ·
`Sep 01 – Sep 10, 2025 · all drivers · ready for roadside or terminal audit`
**Boshqaruv:** `FMCSA / DOT audit pack ▾` · date range · `All drivers ▾` · `All units ▾` ·
o'ngda `Preview` (secondary, `Eye`) · **`Generate pack`** (primary)

**KPI ×4:** `Daily logs included` **1,284** + `58 drivers` · `DVIRs included` **312** +
`14 with defects` · `Unassigned segments` **9** + **danger** `must be resolved` ·
`Uncertified logs` **6** + warning `2 drivers`

#### `What the pack contains` (1fr)
Header + `FMCSA 49 CFR §395.8 output file format`; o'ngda chip `● Validated` (success) yoki
`● Validation failed` (danger).
6 ta checkbox (nom 14/500 + ostida 12 muted):

| ☑ | Nom | Tavsif |
|---|---|---|
| ☑ | `Records of duty status (RODS)` | `Graph grid + event list for every driver and day` |
| ☑ | `Unidentified driving records` | `All unassigned segments and their resolution` |
| ☑ | `Driver log edits and annotations` | `Original value, edited value, reason and approver` |
| ☑ | `Vehicle and ELD identification` | `VIN, unit number, ELD serial and firmware version` |
| ☑ | `DVIRs and defect corrections` | `Pre-trip, post-trip and mechanic signatures` |
| ☐ | `Malfunction and diagnostic events` | `Power, engine sync, timing and data-recording events` |

Ostida ogohlantirish banneri (`--warning-soft`): `9 unassigned driving segments and 6
uncertified logs will be flagged in the pack. Resolve them before a roadside inspection.` +
o'ngda `Resolve now ›` (→ 11.13).

#### `Data transfer` (348 px)
Header + `How the pack reaches the safety official`.
Radio kartalar:
- **`Web services (eRODS)`** / `FMCSA-hosted endpoint · preferred method` (tanlangan — ko'k
  chegara + `--primary-soft` fon)
- `Email to inspector` / `Encrypted attachment to a fmcsa.dot.gov address`
  → tanlanganda **qo'shimcha input**: `Inspector email address *`, validatsiya
  `*.fmcsa.dot.gov`, aks holda `Only fmcsa.dot.gov addresses are accepted.`

`Output file comment` input (max **60** belgi, hisoblagich `43/60`), placeholder
`ROADSIDE INSPECTION 2025-09-10`; ostida `Given to you by the safety official. Max 60 characters.`
**`Send to inspector`** (primary, to'liq kenglik, `Send`); ostida muted:
`A copy is stored in Reports › Recently generated for 24 months.`

> ⚠️ **eRODS TEST rejimi.** `carrier.erodsMode === 'TEST'` bo'lsa kartaning tepasida
> sariq banner: `eRODS · TEST mode — the output file is built in full FMCSA format and sent
> to the FMCSA TEST endpoint. Production eRODS registration is pending — keep a downloaded
> copy for the officer.` (matn 11.14 modalidan). `Send to inspector` matni o'zgarmaydi,
> lekin natija `TEST_ONLY` statusi bilan qaytadi.

#### `Previous transfers`
Header + o'ngda `View all ›`.
Ustunlar: `SENT AT` · `METHOD` (`Web services (eRODS)` / `Email to inspector`) ·
`COMMENT` (`--primary`, bosilganda tafsilot) · `PERIOD` · `SENT BY` (avatar+ism) ·
`RESULT` (`Accepted` success · `Test only` info · `Rejected` danger · `Failed` danger +
`Retry` link).
Manba: `GET /transfers?page&limit`.

**Qabul mezoni:** ⬜ faqat ADMIN/FM · ⬜ 6 checkbox aynan matn · ⬜ 60-belgi hisoblagich ·
⬜ email faqat `fmcsa.dot.gov` · ⬜ TEST banneri · ⬜ `Resolve now` unassigned modaliga o'tadi

---

### W-16 · Messages
**📐 `*/Three-pane driver messaging with context panel.jpg`**
Route `/messages` · Perm `messaging` · **Viewer'da yo'q**

**Header:** `Messages` · `3 unread · 58 drivers reachable`

**Layout — uch panel, to'liq balandlik, padding yo'q:**
```
[ Suhbatlar 280px ][ Chat 1fr ][ Kontekst 268px ]
```

#### Chap panel
- Header: `Conversations` + o'ngda **`+ New`** (primary, kichik)
- Qidiruv `Search driver…`
- Segmentlar: `All 58` · `Unread 3` · `Groups 4`
- Element (72 px): avatar + ism (600) + o'ngda vaqt (`2 min`, `18 min`, `1 h`, `Yesterday`, `2 d`);
  ostida oxirgi xabar (1 qator, kesiladi, muted); o'qilmagan bo'lsa o'ngda ko'k badge (`2`)
- Guruh suhbati: avatar o'rniga initsial plitka (`DE`), nomi `Dispatch — East group`
- Faol suhbat: `--primary-soft` fon

#### O'rta panel
- Header: avatar + `John Smith` + `Unit #101 · On duty · 0 mph`; o'ngda `View logs` ·
  `Assign trip` (`trips` FULL) · `…`
- Xabarlar: sana ajratkichi (`Today · Sep 10`, markazda pill);
  **kiruvchi** — oq pufak, chapda, `--border`;
  **chiquvchi** — `--primary` fon, oq matn, o'ngda; ichida vaqt (`08:12`) va `✓` (yetkazildi) / `✓✓` (o'qildi)
- Pastda tezkor amallar (chip qatori): `Send route` · `Request DVIR` · `Check-in` · `Break reminder`
- Kiritish: `Write a message to John Smith…` + biriktirma ikonkasi + ko'k yuborish tugmasi
  (`Enter` yuboradi, `Shift+Enter` yangi qator)

#### O'ng panel (kontekst)
- 64 px avatar (markazda), `John Smith` (17/600), `Unit #101 · @johnsmith` (muted)
- Tugmalar: `Call` (`Phone`) · `Profile` (`User`)
- `LIVE STATUS`: `Duty status` `On duty` (danger) · `Speed` `0 mph` · `Location` `Florence, KY` ·
  `ELD` `Connected` (success)
- `HOURS OF SERVICE`: `Drive left` `02:32` (danger) · `Shift left` `06:10` (warning) ·
  `Cycle left` `21:40` · `Break in` `00:18` (danger)
- `CURRENT TRIP`: `Trip` `TR-4821` · `Destination` `Florence, KY` · `ETA` `17:40` · `Progress` `72%`

Manba: `GET /conversations`, `GET /conversations/:id/messages?page`.
Yuborish: `POST /conversations/:id/messages` — **optimistic** (`clientId` = uuid),
xato bo'lsa pufak qizil chegara + `Retry`.

**Real-time:** `conversation:{id}` → `message.new`. Ochiq suhbat uchun avtomatik
`subscribe`, boshqasiga o'tganda `unsubscribe`.

**Rol farqlari:** DISPATCHER — ADMIN bilan bir xil (`messaging = FULL`). VIEWER — yo'q.

**Qabul mezoni:** ⬜ uch panel · ⬜ o'qilmagan badge · ⬜ optimistic yuborish · ⬜ 4 tezkor amal ·
⬜ kontekst paneli 3 guruhi · ⬜ WS orqali yangi xabar darhol chiqadi
---

### W-17 · Settings · Company profile
**📐 `admin panel/Settings — company profile and HOS ruleset.jpg`**
Route `/settings/company` · Perm `carrierSettings` FULL · **faqat ADMIN**

**Header:** `Settings` · `Company profile, compliance ruleset and preferences`;
o'ngda **`✓ Save changes`** (primary) — **`dirty` bo'lmasa disabled**.

**`Company profile` kartasi** — 3 ustunli grid:
`Company name *` `Universal Logistics Inc.` · `US DOT number *` `1234567` · `MC number` `MC-892014`
`EIN / Tax ID` `88-4192055` · `Main phone` `+1 614 555 0104` · `Compliance email` `compliance@…`
`Street address` `4517 Washington Ave.` · `City` `Columbus` · `State ▾` `Ohio` · `ZIP` `43004`
(oxirgi qator 4 ustun: address 2 ustun egallaydi)

**`Compliance & operating rules` kartasi** — subtitle
`Applies to every driver unless overridden on the driver profile`; 3 ustunli grid:
`HOS ruleset *` ▾ `US 70 hr / 8 day — Property carrying` · `Cycle restart ▾` `34-hour restart` ·
`Home terminal time zone ▾` `America/New_York (Eastern)`
`Distance unit ▾` `Miles` · `Unassigned driving threshold` `3` + suffix `minutes` ·
`DVIR retention` `24` + suffix `months`

Ostida **2 ta toggle kartasi** (yonma-yon, har biri 1fr — ⚠️ dizaynda ular buzilib
ko'rsatilgan (matn vertikal siqilgan); to'g'ri ko'rinish quyidagicha):

| Karta | Sarlavha | Tavsif | Toggle |
|---|---|---|---|
| 1 | `Allow personal conveyance` | `Drivers may log PC time while off duty` | ✅ yoqilgan |
| 2 | `Allow yard move` | `Yard move is available as an on-duty sub-status` | ✅ yoqilgan |

`HOS ruleset` variantlari (backend `HosRuleset` enum'i bilan 1:1):
`US 70 hr / 8 day — Property carrying` · `US 60 hr / 7 day — Property carrying` ·
`US 70 hr / 8 day — Passenger carrying` · `US 60 hr / 7 day — Passenger carrying`

**eRODS bloki** (⚠️ dizaynda yo'q, lekin `carrierSettings` ga tegishli va backend maydonlari
bor — **qo'shiladi**, chunki `erodsMode` ni boshqarish joyi bo'lishi shart):
`ELD identifier` (4 belgi, `OBK1`, `maxLength=4`, upper-case) ·
`ELD registration ID` (4 belgi) · `eRODS mode ▾` `TEST | PRODUCTION`.
`PRODUCTION` tanlanganda tasdiq modali: `Switching to production sends real files to FMCSA.`

Manba: `GET /carrier` · Saqlash: `PATCH /carrier`.
Saqlangach: `<SavedIndicator>` `✓ All changes saved · last synced 12 seconds ago`.
Sahifadan chiqishda `dirty` bo'lsa — `Discard changes?` tasdig'i.

**Qabul mezoni:** ⬜ 10 + 6 maydon · ⬜ 2 toggle to'g'ri layout · ⬜ eRODS bloki ·
⬜ `Save changes` disabled/enabled · ⬜ `eldIdentifier` aynan 4 belgi validatsiyasi

---

### W-18 · Settings · Users
**📐 `admin panel/Settings — back-office users and invitations.jpg`**
Route `/settings/users` · Perm `users` FULL · **faqat ADMIN**

**Header:** `Settings · Users` · `12 back-office users · 3 admins`; o'ngda
**`Invite user`** (primary, `UserPlus`)

**Boshqaruv:** `All 12` · `Admins 3` · `Fleet managers 5` · `Viewers 4` ·
o'ngda qidiruv `Search user or email…` · `Filters`

**Jadval:** ☐ · `USER` (avatar + ism 600, ostida email 12 muted) ·
`ROLE` (badge: `Admin` violet · `Fleet manager` info · `Dispatcher` success · `Viewer` neutral) ·
`TERMINAL` (`All terminals` / `Columbus, OH`) · `LAST ACTIVE` (`2 minutes ago`, hech qachon → `—`) ·
`STATUS` (`Active` success · `Invited` warning · `Disabled` neutral) · `…`

`…` menyusi: `Edit user` · `Change role` · `Resend invitation` (faqat `Invited`) ·
`Revoke invitation` (faqat `Invited`) · ajratkich ·
`Disable user` / `Enable user` (danger).

> ⚠️ Dizayndagi **`Reset password` punkti olib tashlandi** — back-office foydalanuvchisida
> parol yo'q (faqat Google, 21.1). `Reset two-factor` ham yo'q — 2FA olib tashlangan (Q-4).
> `Drivers` ekranidagi `Reset app password` **qoladi** — u mobil ilova paroli.

**`Pending invitations` kartasi** — header + `1 invitation waiting to be accepted`; o'ngda
`Resend all` (secondary, `Mail`).
Qator: avatar + email (600) + ostida `Dispatcher · Barrie, ON · invited by Sarah Chen on
Sep 08, 2025 · expires in 4 days`; o'ngda `Invited` badge + `Resend` + `Revoke` (danger-outline).

Endpointlar: `GET/POST/PATCH/DELETE /users`, `POST /users/:id/resend-invite`.
Modal: 11.18 `Invite a user`.

---

### W-19 · Settings · Roles & permissions
**📐 `admin panel/Settings — permission matrix across roles.jpg`**
Route `/settings/roles` · Perm `roles` FULL · **faqat ADMIN**

**Header:** `Settings · Roles & permissions` · `4 roles · 12 users assigned`; o'ngda
**`+ Create role`**
**Tab'lar:** `Permission matrix` · `Roles` · `Access log`; o'ngda qidiruv
`Search permission…` · `Reset to defaults` (secondary, `RefreshCw`)

**`Permission matrix` kartasi** — subtitle `Changes apply immediately to every user with
that role`; o'ng yuqorida chip **`Admin cannot be edited`** (`--bg-subtle`).

Jadval: 1-ustun `PERMISSION` (1fr), keyin 4 ustun `ADMIN` · `FLEET MANAGER` · `DISPATCHER` · `VIEWER`
(markazga tekislangan). Guruh sarlavhalari — `--bg-subtle` fonli qator, 11/600 muted:
`FLEET` · `DRIVERS` · `COMPLIANCE` · `MAINTENANCE` · `ADMINISTRATION`.

Dizayndagi qatorlar (aynan):

| Guruh | Qator | Backend kaliti |
|---|---|---|
| FLEET | `View vehicles` / `Add & edit vehicles` | `vehicles` READ / FULL |
| DRIVERS | `View drivers` / `Add & edit drivers` | `drivers` READ / FULL |
| COMPLIANCE | `View HOS logs` / `Request driver log edit` / `Certify on behalf of driver` / `Export FMCSA / DOT pack` | `hos` / `hosEdit` / `hosCertifyOnBehalf` / `reportsTransfer` |
| MAINTENANCE | `View DVIRs & defects` | `dvir` |
| ADMINISTRATION | `Manage users & roles` / `Carrier settings` | `users`+`roles` / `carrierSettings` |

Yacheyka ikonkalari: `✓` yashil doira (FULL) · 👁 sariq (READ) · `–` kulrang (NONE).
Bosilganda **uch holatli** almashish (`NONE → READ → FULL → NONE`) — **ADMIN ustunidan
tashqari** (o'zgarmas, `backend/tz.md` §6.4: `isSystem`).
Pastki qator: legend `✓ Full access  👁 Read only  – No access`; o'ngda
`Last changed by Sarah Chen · Sep 08, 2025`.

> ⚠️ Dizaynda 11 qator ko'rsatilgan, backendda **22 kalit** bor. Qolgan 11 tasi
> (`dashboard`, `liveFleet`, `maintenance`, `safety`, `trips`, `reports`, `messaging`,
> `devices`, `alertRules`, `integrations`, `auditLog`, `support`) **shu formatda,
> mos guruhlarga qo'shiladi** — dizayn kesib ko'rsatgan, to'liq ro'yxat kerak.
> Guruhlar: FLEET (`liveFleet`, `devices`), OPERATIONS (`trips`, `messaging`),
> COMPLIANCE (yuqoridagilar + `reports`), MAINTENANCE (`maintenance`, `safety`),
> ADMINISTRATION (`integrations`, `auditLog`, `alertRules`, `support`, `dashboard`).

`Roles` tab'i: rol kartalari (nom, tavsif, foydalanuvchilar soni, `Edit` / `Delete`;
`Admin` da `System role` chipi va amalsiz).
`Access log` tab'i: `GET /audit-log?objectType=Role`.

Endpointlar: `GET/POST/PATCH/DELETE /roles`. Modal: 11.19 `Create a role`.

---

### W-20 · Settings · ELD devices
**📐 `*/Settings — ELD devices, firmware, heartbeats.jpg`** · Route `/settings/devices` ·
Perm `devices` READ · **ADMIN va FLEET_MANAGER**

**Header:** `Settings · ELD devices` · `69 registered · 37 connected · 32 disconnected`;
o'ngda **`+ Register device`** (`devices` FULL)

**KPI ×3:** `Connected now` **37** + success `54%` · `Disconnected > 24 h` **8** +
danger `needs action` · `Firmware out of date` **11** + info `L113 available`

**Boshqaruv:** `All 69` · `Connected 37` · `Disconnected 32` · `Unassigned 5` ·
o'ngda qidiruv `Search serial or unit…` · `Export`

**Jadval:** ☐ · `SERIAL` (`PT30_A86E`, 600) · `MODEL` (`Pacific Track`) ·
`FIRMWARE` (`L113` normal; **`L108` → `--warning`**) · `UNIT` (`#101` / `—`) ·
`DRIVER` (avatar+ism / `Unassigned` muted) · `LAST SYNC` (`2 minutes ago`, `just now`) ·
`BLE STATE` (badge: `Connected` success · `Out of range` warning · `Disconnected` neutral) ·
`Queued` (o'ngga: `0`, `34`, `128`, `512`; `> 100` → **danger**, `—` biriktirilmaganda)

> `Queued` = `Device.storedEventsCount` (`backend/tz.md` §7.7). `> 100` — `alert.device_backlog`.
> `FIRMWARE` `< L108` bo'lsa qator ostida yupqa ogohlantirish: Virtual Dashboard ishlamaydi.

`…` menyusi (`devices` FULL): `Pair to unit` · `Unpair` · `Update firmware` ·
`View diagnostics` · `Send test command` · `Retire device` (danger).

Endpointlar: `GET /devices`, `POST /devices`, `POST /devices/:id/pair` / `/unpair`,
`PATCH /devices/:id/firmware`, `PATCH /devices/:id/ble-status`, `DELETE /devices/:id`.
Modal: 11.20 `Register an ELD device`.

---

### W-21 · Settings · Alert rules
**📐 `*/Settings — notification channels and alert rules.jpg`** · Route `/settings/alerts` ·
Perm `alertRules` READ · **ADMIN va FLEET_MANAGER**

**Header:** `Settings · Alert rules` · `18 rules · 14 active`; o'ngda **`+ New rule`**

**`Notification channels` kartasi** — subtitle `Where alerts are delivered for this organisation`.
3 qator (`--border`, `--radius-md`), har birida nom + ostida tavsif + o'ngda toggle:

| Kanal | Tavsif | Toggle |
|---|---|---|
| `Email` | `compliance@universal-logistics.com · 4 recipients` | ✅ yoqilgan |
| `SMS` + chip **`Not available`** (neutral) | `SMS is not part of this product — these alerts are delivered by email instead` | ⬜ **disabled, bosilmaydi** |
| `Webhook` | `POST https://tms.universal-logistics.com/hooks/eld · last delivery 200 OK` | ⬜ o'chirilgan |

> ⭐ **SMS ishlatilmaydi.** Buyurtmachi qarori: SMS kanali umuman yo'q, hamma narsa
> **email** orqali. Backend ham `SMS` ni `422 CHANNEL_NOT_AVAILABLE` bilan rad etadi
> (`backend/tz.md` §14). Qator dizaynda bo'lgani uchun **ko'rinadi, lekin doim `disabled`**;
> toggle bosilmaydi, hover'da tooltip `SMS is not available`. Frontend `channels` massiviga
> `SMS` ni **hech qachon qo'shmaydi**.

**Boshqaruv:** `All 18` · `Active 14` · `Muted 4` · qidiruv `Search rule…` · `All severities ▾`

**`Rules` kartasi** — subtitle `Evaluated in real time against ELD telemetry`.
Har bir qator: chapda 32 px severity ikonkasi (`--danger-soft` / `--warning-soft` /
`--info-soft` fon); nom (600) + yonida kanal chiplari (`In-app`, `Email`; **`SMS`** chipi
faqat eski qoidalarda uchrasa — o'chirilgan, kesib tashlangan ko'rinishda); ostida shart matni; o'ngda oluvchi (`Fleet managers + Sarah Chen`)
va ostida holat (`Active` success); eng o'ngda toggle + `…`.

Dizayndagi 5 qoida (aynan): `HOS violation` · `Break required soon` · `ELD disconnected` ·
`Unassigned driving` · `Speeding`.

`…`: `Edit rule` · `Duplicate` · `Test rule` · `Mute for 24 h` · `Delete` (danger).
Endpointlar: `GET/POST/PATCH/DELETE /alert-rules`. Modal: 11.21 `New alert rule`.

---

### W-22 · Settings · Integrations
**📐 `admin panel/Settings — integrations and API keys.jpg`** · Route `/settings/integrations` ·
Perm `integrations` READ · **faqat ADMIN**

**Header:** `Settings · Integrations` · `4 connected · 5 available`; o'ngda
`Browse marketplace` (secondary, `ExternalLink`)

**Karta gridi 3×3** — har bir karta (`--border`, `--radius-lg`, padding 16 px):
40 px ikonka plitka; o'ng yuqorida status badge (`● Connected` success / `Available` neutral);
nom (15/600); tavsif (12 muted); pastki qatorda chapda meta, o'ngda tugma.

| Provayder | Tavsif | Meta | Status |
|---|---|---|---|
| `Pacific Track` | `ELD hardware · PT30 / PT40` | `69 devices syncing` | Connected → `Manage` |
| `McLeod PowerBroker` | `TMS · loads, stops and BOL` | `Last sync 4 minutes ago` | Connected → `Manage` |
| `WEX fuel cards` | `Fuel purchases for IFTA` | `1,842 receipts this quarter` | Connected → `Manage` |
| `QuickBooks Online` | `Accounting & driver settlements` | `Last export Sep 01` | Connected → `Manage` |
| `DAT load board` | `Find and book available loads` | `Connect to post capacity` | Available → `+ Connect` |
| `Slack` | `Push alerts into a channel` | `Send HOS alerts to #dispatch` | Available → `+ Connect` |
| `Geotab` | `Import telematics from mixed fleets` | `Requires MyGeotab credentials` | Available → `+ Connect` |
| `Zapier` | `Automate with 6,000+ apps` | `No-code automation` | Available → `+ Connect` |
| `Custom webhook` | `Send events to your own endpoint` | `JSON over HTTPS` | Available → `+ Connect` |

**`API keys` kartasi** — subtitle `REST v2 · rate limit 600 requests / minute`; o'ngda
**`+ Create key`**.
Ustunlar: `NAME` · `KEY` (`ob_live_••••••••4f21`, monospace, yonida `Copy`) · `SCOPE`
(`read · write`) · `CREATED` · `LAST USED` · `…` (`Edit scopes`, `Revoke` danger).
Endpointlar: `GET /integrations`, `PUT/DELETE /integrations/:provider`,
`GET/POST /api-keys`, `PATCH /api-keys/:id/scopes`, `DELETE /api-keys/:id`.

> Yangi kalit yaratilganda **to'liq qiymat faqat bir marta** modalda ko'rsatiladi:
> `Copy this key now — it will not be shown again.` + `Copy` tugmasi.

---

### W-23 · Settings · Audit log
**📐 `admin panel/Settings — immutable audit trail.jpg`** · Route `/settings/audit` ·
Perm `auditLog` READ · **faqat ADMIN**

**Header:** `Settings · Audit log` · `Every change made in the back office · retained 24 months`;
o'ngda `Export CSV`
**Filtrlar:** qidiruv `Search action, object or user…` · `All users ▾` · `All actions ▾` ·
`Last 30 days ▾` · o'ngda `Filters`

**Jadval:** `TIMESTAMP` (`Sep 10, 15:42:08`) · `USER` (avatar+ism) ·
`ACTION` (badge: `Updated` info · `Created` success · `Deleted` danger · `Viewed` neutral) ·
`OBJECT` (`Driver · John Smith`, `Work order · WO-2214`, `Trip · TR-4830`, `Role · Dispatcher`,
`Vehicle · #144`, `User · Anna Weiss`, `Report · FMCSA audit pack`) ·
`DETAILS` (2 qatorgacha, muted: `Requested log edit for Sep 10 · reason: wrong duty status`) ·
`IP ADDRESS` (`10.14.2.88`, o'ngga).
Pagination: `1–8 of 1,204 events`.
Qator bosilganda — **o'ng drawer**: `before` / `after` JSON diff (qo'shilgan yashil,
o'chirilgan qizil), `traceId`, `userAgent`.
Manba: `GET /audit-log?page&limit&...`.

> Jadval **faqat o'qish uchun** — hech qanday `…` menyusi yo'q (append-only, §18).

---

### W-24 · Settings · Support
**📐 `*/Settings — support channels and tickets.jpg`** · Route `/settings/support` ·
Perm `support` · **barcha rollar**

**Header:** `Settings · Support` · `3 open tickets · average first response 42 minutes`;
o'ngda **`+ New ticket`**

**3 ta kanal kartasi:** `Live chat` / `Mon–Fri, 07:00–21:00 ET` / `› Start chat` (primary) ·
`Email support` / `support@onebookeld.com · replies in ~4 h` / `› Send email` (secondary) ·
`24/7 roadside line` / `+1 800 555 0142 · ELD failures only` / `› Call now` (secondary)

**Boshqaruv:** `Open 3` · `In progress 2` · `Resolved 41` · qidiruv `Search ticket…` ·
`All priorities ▾`

**`Your tickets`** — header + `46 tickets in total`; o'ngda `Export`.
Ustunlar: `TICKET` (`#122229`, `--primary`) · `SUBJECT` (2 qatorgacha) ·
`PRIORITY` (`Urgent` danger · `High` warning · `Normal` neutral) · `OPENED BY` (avatar+ism) ·
`UPDATED` (nisbiy) · `STATUS` (`In progress` warning · `New` info · `Resolved` success).

> ⚠️ **Viewer'da ham `+ New ticket` bor** (dizaynda aniq), garchi matritsa `support = READ`
> desa ham. Qoida: **har bir rol o'z tiketini ocha oladi** — bu `READ` istisnosi sifatida
> 21.4-bo'limda qayd etilgan. Backend `POST /support/tickets` hozir `support:FULL` talab
> qiladi → **o'zgarishi kerak** (20-bo'lim).

Endpointlar: `GET/POST/PATCH /support/tickets`. Modal: 11.22 `New support ticket`.

---

### W-25 · Support · Feedback
**📐 `*/Feedback survey, satisfaction, driver comments.jpg`** ·
Route `/settings/support/feedback` · Perm `support`

**Header:** `Support · Feedback` · `Help us improve OneBook ELD · your answers stay anonymous
to other carriers`
**Tab'lar:** `Send feedback` · `Driver feedback 24` · `Feature requests 7`

**`Send feedback` kartasi (1fr)** — subtitle `Takes about two minutes`.
5 ta savol, har biri 4 ta variantli **segment tugma qatori** (tanlangan — `--primary-soft`
fon + `--primary` chegara va matn):

| Savol | Variantlar |
|---|---|
| `How long have you been using OneBook ELD?` | `< 1 year` · `1–2 years` · `3–5 years` · `5+ years` |
| `How easy is the fleet dashboard to use?` | `Very easy` · `Easy` · `Difficult` · `Very difficult` |
| `How satisfied are you with HOS logging and certification?` | `Very satisfied` · `Satisfied` · `Unsatisfied` · `Not used` |
| `How fast does the dashboard feel?` | `Very fast` · `Fast` · `Average` · `Slow` |
| `Would you recommend OneBook ELD to another carrier?` | `Strongly` · `Recommend` · `Neutral` · `No` |

Ostida `Anything else you would like us to know?` — textarea (3 qator).
`☑ You may contact me about this feedback`.
**`Submit feedback`** — to'liq kenglik, primary, `Send` ikonka.

**`Fleet satisfaction` (348 px):** `4.6` (36/600) + `/ 5`; 5 yulduz (4.6 → 4 to'liq + yarim);
`Based on 24 responses in the last 90 days`; 4 ta o'lchov bar bilan:
`Ease of use 4.6` · `Reliability 4.3` · `Support 4.7` · `Value for money 3.9`
(bar rangi: `≥ 4.5` success, `4.0–4.4` success och, `< 4.0` warning).

**`Recent driver feedback` (348 px):** `From the mobile app`; 3 ta karta:
avatar + ism + o'ngda yulduzlar; sitata (kursiv, tirnoqda); ostida nisbiy vaqt.

Endpoint: `POST /feedback`. Yuborilgach forma o'rniga success holati:
`Thank you — your feedback was sent.` + `Send another`.

---

### W-26 · My profile
**📐 `*/Personal account — profile, security, sessions.jpg`** · Route `/account` · barcha rollar

**Header:** `My profile` · `Sarah Chen · Admin · Universal Logistics Inc.`
(⚠️ dizaynda barcha rollarda `Admin` yozilgan — bu **mock artefakti**; haqiqiy rol nomi qo'yiladi)

Chapda 4.6-bo'limdagi `MY ACCOUNT` navigatsiyasi. O'ngda 3 karta:

**`Profile`** — subtitle `Shown to your team and on records you sign`.
- Chapda 64 px avatar; o'ngda `Profile photo` + `PNG or JPG, at least 256 × 256 px. Appears
  on your signature block.`; eng o'ngda `Upload` (secondary, `Upload`) + `Remove` (danger-outline)
- Grid 3 ustun: `First name *` · `Last name *` · `Job title`
- Grid 2 ustun: `Work email` — **disabled**, `Mail` ikonka, ostida `Managed by your
  administrator`; `Mobile number` — o'ngda yashil `Verified` yorlig'i

**`Security & sign-in`** — chip yo'q (dizayndagi `● Two-factor on` olib tashlandi, Q-4).

> ⚠️ **Parol maydonlari olib tashlanadi.** Kirish faqat Google orqali bo'lgani uchun
> `Current password` / `New password` / `Confirm new password` gridi **qurilmaydi**.

- O'rniga **`Sign-in method`** ichki kartasi: chapda 32 px Google logotipi;
  `Google account` (14/600) + ostida foydalanuvchining Gmail manzili (12 muted);
  o'ngda `● Connected` badge (success).
  Ostida 12/muted: `Your password and account recovery are managed by Google.`
- Dizayndagi `Two-factor authentication` ichki kartasi va toggle **qurilmaydi** (Q-4).

**`Active sessions`** — subtitle `Signing out ends access on that device immediately`;
o'ngda `Sign out everywhere` (danger-outline, `LogOut`).
Ustunlar: `DEVICE` (`MacBook Pro · Chrome 129`) · `LOCATION` · `IP ADDRESS` ·
`LAST ACTIVE` (`Now · this device` yashil / `2 hours ago`) · o'ngda `● Current` badge yoki
`Sign out` tugmasi.
Endpointlar: `GET/PATCH /me/profile`, `GET /me/sessions`, `DELETE /me/sessions/:id`.

**Qolgan bo'limlar** (`Notifications`, `Language & region`) — dizaynda alohida chizilmagan;
ular shu sahifada davomiy kartalar sifatida:
- `Notifications`: kanal bo'yicha checkbox matritsasi (`HOS violation`, `Break due`,
  `ELD disconnected`, `Report ready`, `New message`) × (`In-app`, `Email`)
- `Language & region`: `Language ▾` (`English` — v1 da yagona), `Time zone ▾`,
  `Date format ▾` (`MMM D, YYYY`), `Distance unit` (carrier'dan meros, disabled)
---

## 11. Modallar, drawerlar va menyular katalogi

30 ta overlay `web/roles and screens/sheets, modals, drawers, menus/` da chizilgan.
Har biri quyida **mazmuni bo'yicha** raqamlangan; `📁` — haqiqiy fayl nomi (u mazmunga mos emas).

---

### 11.1 · Create a geofence
📁 `Sign in — split brand panel with SSO.jpg` · Live Fleet ustida · `liveFleet` FULL · `lg` (660 px)

Sarlavha `Create a geofence` / `Trigger arrival, departure and dwell-time events`.

- 3 ustun: `Geofence name *` (`Columbus terminal`) · `Type ▾` (`Terminal / yard`, `Shipper`,
  `Customer`, `Rest area`, `Other`) · `Colour ▾` (`Blue`, `Green`, `Amber`, `Red`, `Violet`)
- Xarita 190 px; ustida chizish segmentlari: `Circle` · **`Rectangle`** (faol) · `Polygon` ·
  `Address`; xaritada tanlangan hudud ko'k, burchaklarda drag nuqtalari
- 3 ustun: `Address` (`4517 Washington Ave., Columbus, OH 43004`, `MapPin` ikonka) ·
  `Radius / size` (`0.8` + suffix `mi`) · `Applies to ▾` (`All vehicle groups`)
- 4 checkbox: ☑ `Arrival event` · ☑ `Departure event` · ☑ `Dwell longer than 45 min` ·
  ☐ `After-hours entry`
- Footer: ☑ `Count time inside as on-duty yard move` · `Cancel` · **`Save geofence`**

Endpoint `POST /geofences`. `Rectangle` → backend `POLYGON` (4 nuqta).
⚠️ `Dwell` va `After-hours` uchun backend `Geofence` modelida maydon **yo'q**
(`alertOnEnter`/`alertOnExit` bor) → 20-bo'lim. Yo'q bo'lsa **checkbox'lar disabled**.

---

### 11.2 · Add vehicle
📁 `Fleet overview — KPIs, live map, duty mix, violation feed.jpg` · `vehicles` FULL · `lg`

`Add vehicle` / `Register a unit and pair it with an ELD device`

| Qator | Maydonlar |
|---|---|
| 1 | `Unit number *` (`e.g. 126`) · `ELD type * ▾` (`Pacific Track`) · `ELD serial * ▾` (`PT30_1C4F`) — ostida hint `5 unpaired devices available` |
| 2 | `Make * ▾` · `Model * ▾` · `Year * ▾` · `Fuel type * ▾` (`Diesel`, `Gasoline`, `CNG`, `LNG`, `Electric`) |
| 3 | `VIN *` (17 belgi) + `Get VIN from ELD` (secondary) + `Enter manually` (secondary). ELD dan olinsa ostida `Read from the ELD device 4 seconds ago` |
| 4 | `License plate *` · `Issuing state ▾` · `Home terminal ▾` |
| 5 | `Assign driver ▾` (`None` yoki drayver) · `Co-driver ▾` · `Odometer at activation` (`221,449` + `mi`) |
| 6 | `Notes` — textarea, `Optional — visible to fleet managers only` |

Footer: ☑ `Send the driver a pairing notification` · `Cancel` · `Save and add another` · **`Save unit`**

`POST /vehicles` → toast `Unit #126 created` / `ELD PT30_1C4F paired and the driver was notified.`
Validatsiya: VIN 17 belgi `[A-HJ-NPR-Z0-9]`, `Unit number` unikal (`409` → maydon xatosi
`A unit with this number already exists.`), `Odometer at activation` — `odometerMi`
(offset shundan hisoblanadi, §4.3).
Edit rejimida: sarlavha `Edit unit #101`, `ELD serial` o'zgartirilsa ogohlantirish
`Changing the ELD device unpairs the current one.`, footer `Save changes`.

---

### 11.3 · Delete unit (destruktiv tasdiq)
📁 `Unit inventory — ELD serial, VIN, odometer.jpg` · `vehicles` FULL · `sm` (420 px)

`Delete unit #121?` / `This cannot be undone`
- 48 px `--danger-soft` doira + `Trash2`
- Matn: `Deleting Unit #121 removes it from the fleet list and unassigns ELD device PT30_1F02.
  Historical logs, DVIRs and IFTA records stay in place and remain available for audits.`
- Ogohlantirish (`--warning-soft`): `This unit has 1 open defect and an active work order.
  Close them first to keep the maintenance history complete.`
- `Type UNIT-121 to confirm` + input (placeholder `UNIT-121`) — **aynan mos kelmaguncha
  tugma disabled**
- Footer: `Cancel` · **`Delete unit`** (danger)

`DELETE /vehicles/:id`. Backend soft-delete qiladi (D-003) — matn shuni aks ettiradi.

---

### 11.4 · Assign driver to unit
📁 `Route replay, drive : stop : idle segments.jpg` · `vehicles` FULL (yoki `trips` FULL — 21.3) · `md`

`Assign driver to unit #126` / `Freightliner Cascadia 2023 · ELD PT30_1C4F`
- Qidiruv `Search driver by name, username or licence…`
- Radio ro'yxati — har bir qator: avatar + ism (600) + ostida
  `Off duty · no unit assigned · Raleigh, NC`; o'ngda ikki qator HOS:
  `11:00 drive` (rangli) / `70:00 cycle` (muted)
- 2 ustun: `Role ▾` (`Primary driver` / `Co-driver`) · `Co-driver ▾` (`None`)
- 2 ustun: `Effective from` (datetime, `Sep 11, 2025 05:00`) · `Trailer ▾` (`Not set`)
- Info banner (`--info-soft`): `Kristin Watson has full hours available and is at the same
  home terminal as unit #126.`
- Footer: ☑ `Notify the driver in the app` · `Cancel` · **`Assign driver`**

`POST /vehicles/:id/assign-driver`. Unit `OUT_OF_SERVICE` bo'lsa — ro'yxat o'rniga
danger banner: `Unit #110 is out of service. Close the critical defect before assigning a driver.`
va tugma disabled (`backend/tz.md` §5.10 qoidasi).
Load uchun variant: sarlavha `Assign driver to load LD-9912`, endpoint `POST /trips/:id/assign`.

---

### 11.5 · Calibrate odometer
Dizaynda alohida chizilmagan (`Unit profile` dagi tugma). `vehicles` FULL · `sm`

`Calibrate odometer` / `Unit #101 · Freightliner Cascadia`
- Faqat-o'qish qatorlar: `ELD reading` `981,109 mi` · `Current offset` `+12,480 mi` ·
  `Calculated odometer` `993,589 mi`
- `Dashboard odometer *` — input (`mi`), majburiy
- Hisoblangan yangi offset jonli ko'rsatiladi: `New offset: +12,502 mi`
- Info: `The ELD reports a relative odometer. The offset keeps recorded distance aligned
  with the dash reading. This action is written to the audit log.`
- Footer: `Cancel` · **`Save calibration`**

`POST /vehicles/:id/calibrate-odometer`. Farq **> 5 000 mi** bo'lsa qo'shimcha tasdiq.

---

### 11.6 · Import vehicles
📁 `Driver roster with live HOS clocks and violations.jpg` · `vehicles` FULL · `md`

`Import vehicles` / `Bulk-create or update units from a CSV file`
- Tab: **`Import`** · `Export`
- Dropzone (punktir chegara, `--radius-lg`, 110 px): `Drop your CSV here or click to browse` /
  `Up to 5 MB · one unit per row · 2,000 rows maximum`
- Fayl tanlangach karta: fayl ikonkasi + `fleet-units-september.csv` +
  `142 KB · 38 rows detected · 38 valid, 0 errors`; o'ngda `● Ready` (success) + `X`
- 2 ustun: `Duplicate handling ▾` (`Update existing units by VIN` / `Skip existing` /
  `Always create new`) · `Default terminal ▾`
- ☑ `Pair ELD devices automatically` + `Match the ELD serial column to unpaired devices`
- ☑ `Send a summary email when the import finishes`
- Info qator: `Not sure about the format?` + `Download CSV template` (link)
- Footer: `Cancel` · **`Import 38 units`**

`POST /vehicles/import`. Natija — `<ProgressCard>`, tugagach xulosa:
`36 imported · 2 updated · 0 failed` + xatolar bo'lsa CSV yuklab olish havolasi.

---

### 11.7 · Import drivers
📁 `Drivers → "Import".jpg` · `drivers` FULL · `md`

11.6 bilan bir xil, farqlari:
- `Import drivers` / `Bulk-create driver accounts from a CSV file`
- Dropzone: `one driver per row · 500 rows maximum`
- Fayl kartasi: `drivers-q4-intake.csv` · `86 KB · 24 rows detected · 22 valid, 2 need attention`;
  o'ngda **`● 2 warnings`** (warning)
- **Ogohlantirish bloki** (`--warning-soft`, ikki qator):
  `Row 12  Duplicate username "jcooper" — will be skipped`
  `Row 19  Missing CDL issuing state — driver will be created as incomplete`
  *(qo'shimcha tekshiruv: `Row N  Missing or duplicate email — driver cannot sign in`)*
- `Duplicate handling ▾` (`Skip existing usernames`) · `Default terminal ▾`
- ☑ `Send app invitations after import` / `Each driver receives an email with a one-time sign-in code`
- ☑ `Apply default HOS exemptions` / `Personal conveyance and yard move enabled`
- Footer: **`Import 22 drivers`**

> ⚠️ Dizaynda bu qatorda «SMS» yozilgan. **SMS umuman ishlatilmaydi** (21.5), shuning
> uchun matn `email` ga o'zgartirildi. Drayverga taklifnoma **email orqali** boradi.

---

### 11.8 · Add driver
📁 `24-hour ELD graph grid, available hours, certification.jpg` · `drivers` FULL · `lg`

`Add driver` / `Creates a driver account for the OneBook ELD mobile app`

**`PERSONAL DETAILS`** (seksiya sarlavhasi 11/600 muted):
`First name *` · `Last name *` · `Username *` (`Used to sign in to the app`)
`Password *` (`Minimum 8 characters`, `Eye`) · **`Email address *`** · `Phone number *`

> ⭐ **`Email address` — drayverning Gmail manzili va uning kirish identifikatori** (§6.8).
> Maydon **majburiy va unikal**; ostida hint:
> `Gmail address the driver signs in with. In production it must be verified.`
> Prod rejimida yonida `Send verification` tugmasi paydo bo'ladi va tasdiqlanmaguncha
> drayver profilida `● Email not verified` badge turadi.

**`LICENCE & TERMINAL`**:
`Driver licence number *` · `Issuing state * ▾` · `Home terminal * ▾`
`Assigned unit ▾` (`#126`) · `Co-driver ▾` (`None`) · `Fleet manager ▾` (`Mike Rowan`)

**`HOS EXEMPTIONS AND ALLOWANCES`** — 2 qatorli checkbox gridi (3 ustun):
☑ `Allow personal conveyance` · ☑ `Allow yard move` · ☐ `Adverse driving conditions`
☐ `Short-haul exception (150 air-mile)` · ☑ `Enable split sleeper berth` · ☐ `Exempt from ELD (8-day rule)`

Info banner: **`The driver receives an email with the app download link and a one-time
sign-in code.`** (dizaynda «SMS» yozilgan — 21.5 bo'yicha `email` ga o'zgartirildi;
drayverda email bo'lmasa, admin `Reset app password` orqali kodni qo'lda beradi).
Footer: ☑ `Send invitation now` · `Cancel` · `Save and add another` · **`Save driver`**

`POST /drivers`. ⚠️ `Driver.email` backendda hozir **ixtiyoriy va unikal emas**
(`email String?`) — B-30 buni majburiy + `@unique` qiladi.
Maydon → backend: `email`, `cdlNumber`, `cdlState`, `homeTerminalName`,
`homeTerminalTimezone` (terminal tanlovidan avtomatik), `fleetManagerId`,
`assignedVehicleId`, `allowPersonalConveyance`, `allowYardMove`, `adverseDrivingEnabled`,
`shortHaulException`, `splitSleeperEnabled`, `eldExempt`.
`eldExempt` belgilansa — qo'shimcha majburiy input `Exemption reason *`.

---

### 11.9 · Drivers — qator menyusi va bulk bar
📁 `DVIRs, open defects, preventive maintenance.jpg`

Menyu tarkibi W-06 da yozilgan. Bulk bar: pastda markazda, qora (`--bg-inverse`),
`--radius-lg`, `--shadow-pop`, 56 px:
`3 drivers selected` (oq 600) · `Assign unit` · `Send message` · `Export logs` ·
`Deactivate` · o'ngda `X`. Tugmalar — ghost, oq matn, hover `rgba(255,255,255,.1)`.
Chiqish animatsiyasi: pastdan 200 ms.

---

### 11.10 · Create trip
📁 `Driver profile — HOS clocks, violations, logs.jpg` · `trips` FULL · `lg`

`Create trip` / `Dispatch a load to a driver and unit`
- 3 ustun: `Trip / load ID *` (`TR-4834`) · `Customer ▾` · `Reference / BOL` (`4834-A`)
- **`STOPS`**: `Pickup location *` (`MapPin`) · `Pickup window` (datetime range) ·
  `Delivery location *` · `Delivery window`; ostida punktir tugma
  `+ Add an intermediate stop` (to'liq kenglik)
- **`ASSIGNMENT`**: `Driver * ▾` — ostida hint `02:32 drive time left today` ·
  `Unit * ▾` (`#101 · Freightliner Cascadia`) · `Trailer ▾` (`TR-4410`)
- 4 ustun: `Distance` (`182` + `mi`) · `Estimated drive time` (`03:10` + `h`) ·
  `Weight` (`18,400` + `lbs`) · `Rate` (`1,240.00` + `USD`)
- ⭐ **HOS ogohlantirish banneri** (`--warning-soft`): `John Smith has 02:32 of drive time
  left. This trip needs 03:10 — a 10-hour reset will be required before delivery.` +
  o'ngda `Pick another driver` tugmasi
- Footer: ☑ `Send the trip to the driver app now` · `Cancel` · `Save as draft` · **`Create trip`**

`POST /trips`. HOS bannerini frontend hisoblaydi: `estimatedDriveSec > driveRemainingSec`.
Banner **bloklamaydi** — dispetcher baribir yaratishi mumkin (reset rejalashtirilgan bo'lishi mumkin).

---

### 11.11 · Request a log edit ⭐
📁 `Harsh driving, speeding, fleet score, scorecard.jpg` · `hosEdit` FULL · `lg`

`Request a log edit` / `John Smith · Wed, Sep 10, 2025 · driver approval required`

- ⭐ **Huquqiy banner** (`--warning-soft`, `AlertTriangle`): `Under 49 CFR §395.30 a carrier
  may only suggest an edit. The driver must review and accept it in the mobile app before
  the log changes.`
- 3 ustun: `Date` (`Wed, Sep 10, 2025`) · `Start time` (`14:26:58`) · `End time` (`15:30:00`)
- `Duty status` — 6 ta radio chip: `OFF duty` · `Sleeper` · `Driving` · **`ON duty`** (tanlangan,
  ko'k chegara) · `Yard move` · `Personal`
- 3 ustun: `Location` (`0.64 mi N of Florence, KY`) · `Odometer` (`993,589` + `mi`) ·
  `Engine hours` (`1079.4` + `h`)
- `Reason for the edit *` — textarea; ostida `Stored with the record and shown to the driver
  and to any safety official.`
- **Before / After paneli** — 2 ta ichki karta (`--bg-subtle`):
  `BEFORE` → `ON 14:26 → 15:30` · `AFTER` → `ON 14:26 → 15:30 (annotated)` (`--primary`)
- Footer: ☑ `Notify the driver immediately` · `Cancel` · **`Send edit request`**

`POST /logs/:driverId/edit-requests`.
⛔ **`Driving` tanlanishi va mavjud `D` segmentiga tegish taqiqlanadi:** `Driving` chipi
disabled bo'ladi agar tanlangan interval avtomatik `D` yozuvini qamrab olsa; server
`422 DRIVING_TIME_IMMUTABLE` qaytarsa modal ichida qizil banner:
`Driving time can never be shortened, deleted or restatused (49 CFR §395.30).`
`Reason` minimal **4 belgi** (Appendix A annotation talabi), maksimal 60.

---

### 11.12 · Certify logs
📁 `IFTA by jurisdiction and the report library.jpg` · **`hosCertifyOnBehalf` FULL (ADMIN)** · `md`

`Certify logs` / `John Smith · select the days to certify on the driver behalf`
- ⭐ Banner (`--danger-soft`): `Certification is the driver signature. Only an administrator
  may certify on behalf of a driver, and the action is written to the audit log.`
- Kun kartalari (checkbox bilan, tanlanganda ko'k chegara):
  `Wed, Sep 10` / `OFF · SB · D · ON  07:30 · 02:00 · 11:26 · 03:04` / o'ngda `Uncertified` (warning)
  `Tue, Sep 09` … / `Mon, Sep 08` … / `Sun, Sep 07` … (`Certified` — checkbox **disabled**)
- `Administrator signature` — 90 px ichki karta, markazda imzo shrifti bilan `Sarah Chen`,
  ostida `Signed on Sep 10, 2025 at 16:12 ET`
- Footer: `Cancel` · **`Certify 2 selected days`** (son tanlovga qarab o'zgaradi)

`POST /logs/:driverId/certify { dates: [...] }`.
Tanlov bo'sh — tugma disabled. `422 RECERTIFICATION_REQUIRED` → banner
`The log changed after the last certification — it must be certified again.`

---

### 11.13 · Unassigned driving ⭐
📁 `Settings — ELD devices, firmware, heartbeats.jpg` · `hosEdit` FULL · `lg`

`Unassigned driving` / `9 segments recorded with no driver logged in · 12h 40m total`
- Banner (`--warning-soft`): `Unassigned segments must be assigned to a driver or annotated
  before a DOT audit. Segments under 3 minutes may be annotated as yard movement.`
- Segment qatorlari (checkbox + tanlanganda ko'k chegara):
  ```
  ☑ Unit #101   Sep 10  05:12 – 05:18   [00:06]        [ John Smith            ▾ ]
    0.8 mi · Columbus, OH terminal
  ☑ Unit #103   Sep 09  12:30 – 13:42   [01:12]        [ Suggest: Cody Fisher  ▾ ]
    58 mi · Barrie, ON → Oakville, ON
  ☐ Unit #107   Sep 09  06:02 – 06:05   [00:03]        [ Annotate as yard move ▾ ]
    0.3 mi · Florence, KY yard
  ☐ Unit #118   Sep 08  21:14 – 22:40   [01:26]        [ Unassigned            ▾ ] (muted)
  ```
  Davomiylik — kulrang pill. Dropdown variantlari: drayverlar ro'yxati ·
  `Suggest: <name>` (server tavsiyasi) · `Annotate as yard move` · `Annotate as personal
  conveyance` · `Leave unassigned`
- `Annotation applied to the selected segments *` — textarea
  (`Yard movement at the home terminal — driver not yet logged in.`), **min 4 belgi**
- Footer: ☑ `Ask each driver to confirm in the app` · `Cancel` · **`Assign 2 segments`**

Endpointlar: `POST /unidentified/:id/assign { driverId, annotation }` ·
`/annotate { annotation }` · `/reject`.
⭐ **Muhim:** biriktirilgandan keyin `recordOrigin` **`1` bo'lib qoladi** (`backend/tz.md` §7.4).
UI hech qayerda «driver entered» deb ko'rsatmaydi — `ORIGIN` ustunida `ELD · automatic`
qoladi, faqat `Assigned by Sarah Chen · Sep 10` izohi qo'shiladi.

---

### 11.14 · Send logs to a safety official ⭐
📁 `Settings — permission matrix across roles.jpg` · `reportsTransfer` FULL · `lg`

`Send logs to a safety official` / `FMCSA §395.34 data transfer · 8 days ending Sep 10, 2025`
- ⭐ **TEST banner** (`--warning-soft`): `eRODS · TEST mode` /
  `The output file is built in full FMCSA format and sent to the FMCSA TEST endpoint.
  Production eRODS registration is pending — keep a downloaded copy for the officer.`
  (faqat `carrier.erodsMode === 'TEST'`)
- 2 ustun: `Driver * ▾` · `Date range *` (`Sep 03 – Sep 10, 2025`, **max 8 kun**)
- **`TRANSFER METHOD`** — radio kartalar:
  `Web services (eRODS)` / `Uploads directly to the FMCSA endpoint. Preferred at roadside.` (tanlangan)
  `Email to a safety official` / `Encrypted file sent to an fmcsa.dot.gov address only.`
- `Output file comment *` (`ROADSIDE INSPECTION 2025-09-10`) + `Provided by the safety
  official. Maximum 60 characters.`
- **`FILE PREVIEW`** paneli (`--bg-subtle`), label chapda muted / qiymat o'ngda:
  `File name` `ONEB01_Smith_20250910.csv` · `Records` `8 daily logs · 312 events · 0 unassigned` ·
  `Includes` `RODS, edits, annotations, DVIRs, ELD malfunctions` ·
  `Certificate` `ELD registration #ONEB01 · TEST (pending)` (warning)
- Validatsiya paneli: `✓ Validation passed. No unassigned segments or uncertified logs in
  this range.` (success) yoki warning ro'yxati (`UNRESOLVED_UNIDENTIFIED`,
  `UNCERTIFIED_LOGS`, `ACTIVE_MALFUNCTION`)
- Footer: `Cancel` · `Download a copy` · **`Send transfer`**

> ⚠️ **Fayl nomi dizaynda noto'g'ri.** `ONEB01_Smith_20250910.csv` — `backend/tz.md` §10.2
> (Appendix A 4.8.2.2) formatiga **zid**. To'g'ri format:
> `[familiya 5 belgi][prava oxirgi 2][fayl ketma-ketligi 2][kun soni 1].csv` → **`SMITH38018.csv`**.
> Frontend fayl nomini **o'zi yasamaydi** — backend `POST /transfers` javobidagi `fileName`
> ni ko'rsatadi. Preview panelida shu qiymat chiqadi.
> Xuddi shunday `#ONEB01` — 6 belgi; `eldIdentifier` **4 belgi** (`OBK1`).
> Preview `carrier.eldIdentifier` dan oladi.

`POST /transfers { driverId, method, rangeStart, rangeEnd, outputFileComment }`.
Email tanlansa qo'shimcha input + `*.fmcsa.dot.gov` validatsiyasi
(`422 INVALID_TRANSFER_RECIPIENT`).
---

### 11.15 · DVIR detail (o'ng drawer)
📁 `Unit profile — telemetry, details, activity log.jpg` · `dvir` READ · drawer 420 px

`DVIR #88215` / `Unit #110 · pre-trip · Sep 10, 2025 04:58`
- Yuqorida danger banner: `⚠ Defects not corrected — unit is out of service`
- **`INSPECTION`** bo'limi (label chapda muted / qiymat o'ngda 600):
  `Driver` `Bessie Cooper` · `Type` `Pre-trip` · `Submitted` `Sep 10, 04:58 ET` ·
  `Location` `Scarborough Town Centre, ON` · `Odometer` `311,204 mi` ·
  `Trailer` `TR-4410 · bobtail: no`
- **`DEFECTS · 2`** — har biri ichki karta: `Brakes, Service` (600) + o'ngda `● Critical`;
  ostida `Air pressure drops below 90 psi on grade`
- **`PHOTOS · 2`** — 2 ustunli grid, 90 px, `--bg-subtle`, markazda `Eye` ikonka;
  bosilganda lightbox (presigned URL, 15 daqiqa)
- 2 ta imzo kartasi: `Driver signature` / **`Bessie Cooper`** (imzo shrifti) / `Sep 10, 04:58` ·
  `Mechanic signature` / `Not signed` (muted) / `Pending`
- Footer (sticky): `Print` · `Export PDF` · **`Create work order`** (primary, `maintenance` FULL)

`GET /dvir/:id`. `Mechanic sign-off` — `POST /dvir/:id/mechanic-signoff`.
Read-only rollarda footer'da faqat `Print` va `Export PDF`.

---

### 11.16 · Create work order
📁 `Active trips, route timeline, unassigned loads.jpg` · `maintenance` FULL · `lg`

`Create work order` / `Unit #110 · Peterbilt 579 · 2 open defects`
- **`DEFECTS TO INCLUDE`** — checkbox kartalari (tanlangan → ko'k chegara):
  ☑ `Brakes, Service` / `Critical · air pressure drops below 90 psi on grade` / o'ngda `Sep 10, 04:58`
  ☑ `Lights (Head - Stop)` / `Major · left stop lamp inoperative` / `Sep 10, 04:58`
  ☐ `Windshield wipers` / `Minor · streaking on the driver side` / `Sep 07, 18:20`
- 3 ustun: `Assign to * ▾` (`Mike Rowan · Shop A`) · `Priority * ▾`
  (`Critical — out of service`, `High`, `Normal`, `Low`) · `Due date` (`Sep 11, 2025`)
- 3 ustun: `Estimated labour` (`4.0` + `hours`) · `Estimated parts cost` (`620.00` + `USD`) ·
  `Odometer at service` (`311,204` + `mi`)
- `Work to perform` — textarea
- 3 checkbox bir qatorda: ☑ `Keep the unit out of service until closed` ·
  ☑ `Notify the driver` · ☑ `Block dispatch assignment`
- Footer: `Cancel` · `Save as draft` · **`Create work order`**

`POST /work-orders` + har bir defekt uchun `POST /work-orders/:id/defects/:defectId`.
`Keep out of service` → `Vehicle.status = OUT_OF_SERVICE`.

---

### 11.17 · Resolve defect
📁 `Feedback survey, satisfaction, driver comments.jpg` · `dvir` FULL · `md`

`Resolve defect` / `Unit #110 · Brakes, Service · reported Sep 10, 04:58`
- Danger karta: `Brakes, Service` + o'ngda `● Critical · out of service`; ostida
  `Air pressure drops below 90 psi on grade. Reported by Bessie Cooper during the pre-trip inspection.`
- **`RESOLUTION`** — radio kartalar:
  **`Repaired`** / `The defect was corrected and the unit is safe to operate` (tanlangan)
  `No repair needed` / `Inspected and found to be within specification`
  `Deferred` / `Non-safety defect scheduled for a later service`
- 2 ustun: `Corrected by * ▾` (`Mike Rowan · Shop A`) · `Completed on` (`Sep 10, 2025 14:20`)
- 3 ustun: `Labour hours` (`3.5` + `h`) · `Parts cost` (`486.20` + `USD`) · `Work order ▾` (`WO-2214`)
- `Repair notes *` — textarea
- 2 ta imzo kartasi: `Mechanic signature` / `Mike Rowan` · `Driver acknowledgement` / `Pending` (muted)
- Footer: ☑ `Return unit #110 to service` · `Cancel` · **`Mark as resolved`**

`PATCH /defects/:id/resolve`. `Deferred` tanlansa `Return unit to service` **avtomatik
o'chadi va disabled** (kechiktirilgan kritik defekt unitni qaytarmaydi).

---

### 11.18 · Invite a user
📁 `Settings — notification channels and alert rules.jpg` · `users` FULL · `md`

`Invite a user` / `Back-office access only — drivers are added under Drivers`
- 2 ustun: `Full name *` (`Anna Weiss`) · `Work email *` (`Mail` ikonka)
- **`ROLE`** — radio kartalar (tanlangan → ko'k chegara + `--primary-soft`):
  `Fleet manager` / `Full access to vehicles, drivers, HOS and maintenance`
  **`Dispatcher`** / `Trips, messaging and read-only compliance data` (tanlangan)
  `Viewer` / `Read-only across the whole account`
  > ⚠️ **`Admin` varianti ro'yxatda yo'q** (dizaynda ham). Admin qo'shish — mavjud
  > foydalanuvchining rolini `Change role` orqali o'zgartirish bilan, qo'shimcha tasdiq bilan.
- `Terminal access ▾` (`Barrie, ON` / `All terminals`)
- Dizayndagi `Require two-factor authentication` checkbox'i **qurilmaydi** (Q-4)
- `Message (optional)` — textarea
- Footer: chapda muted `The invitation expires in 7 days.` · `Cancel` · **`Send invitation`**

`POST /users`. `409` → `A user with this email already exists.`

> ⭐ **Google-only muhim nuqta:** `Work email` — bu foydalanuvchi **kiradigan Google
> hisobining aynan o'sha manzili** bo'lishi shart (`POST /auth/google` email bo'yicha
> qidiradi). Shuning uchun maydon ostiga hint qo'shiladi:
> `Must be the Google account the user signs in with.`
> Taklifnoma xatida havola parol o'rnatishga emas, **`Sign in with Google`** ga olib boradi.

---

### 11.19 · Create a role
📁 `Settings — integrations and API keys.jpg` · `roles` FULL · `md`

`Create a role` / `Start from a template and adjust the permissions`
- 2 ustun: `Role name *` (`Compliance auditor`) · `Copy permissions from ▾` (`Fleet manager`)
- `Description` — textarea (`Read-only access to logs, DVIRs and reports for internal audits.`)
- **`PERMISSIONS`** — qatorlar, o'ngda 3 holatli segment (`None` / `Read` / `Full`):
  `Vehicles` (Read) · `Drivers` (Read) · `HOS logs & edits` (Read) ·
  `DVIR & maintenance` (Read) · `Reports & exports` (**Full**) · `Users & roles` (**None**)
- 2 checkbox: ☑ `Can export FMCSA / DOT pack` · ☐ `Can send data transfers`
- Footer: `Cancel` · **`Create role`**

`POST /roles { key, name, description, permissions }`.
`Copy permissions from` tanlanganda segmentlar avtomatik to'ldiriladi.
⚠️ Dizayn 6 guruhga siqilgan; ular 22 kalitga shunday xaritalanadi:
`Vehicles`→`vehicles`+`liveFleet` · `Drivers`→`drivers` ·
`HOS logs & edits`→`hos`+`hosEdit` · `DVIR & maintenance`→`dvir`+`maintenance`+`safety` ·
`Reports & exports`→`reports` · `Users & roles`→`users`+`roles`.
Ikki checkbox → `reportsTransfer` (`FULL`/`NONE`).
Ko'rsatilmagan kalitlar (`dashboard`, `messaging`, `trips`, `devices`, `alertRules`,
`integrations`, `auditLog`, `support`, `carrierSettings`, `hosCertifyOnBehalf`) shablondan
meros bo'ladi; `hosCertifyOnBehalf` va `carrierSettings` **hech qachon avtomatik `FULL`
bo'lmaydi** — faqat `Roles` tab'idagi to'liq tahrirlashda.

---

### 11.20 · Register an ELD device
📁 `Settings — plan, usage, payment, invoices.jpg` · `devices` FULL · `md`

`Register an ELD device` / `Pair a new Pacific Track PT30 with the fleet`
- Tab: **`Single device`** · `Bulk register`
- 2 ustun: `Device model * ▾` (`Pacific Track`) · `Serial number *` (`PT30_1C4F`, ikonka)
- QR karta (`--primary-soft`): 40 px ikonka + `Scan the QR code on the device` /
  `The serial and firmware version are filled in automatically`; o'ngda `Open scanner` (secondary, `Eye`)
- 2 ustun: `Assign to unit ▾` (`#126`) · `Firmware` — **disabled** (`L113 (latest)`)
- 2 ta toggle kartasi:
  `Update firmware automatically` / `Install new versions over Bluetooth while the engine is off` — ✅
  `Send diagnostics to OneBook support` / `Helps resolve connection problems faster` — ⬜
- Success banner: `✓ Device responded to the pairing request · signal strength good · GPS lock acquired.`
- Footer: `Cancel` · `Test connection` · **`Register device`**

`POST /devices` + `POST /devices/:id/pair`. `Test connection` — ⚠️ backendda endpoint
**yo'q** (`GET /devices/:id/diagnostics` tz.md'da bor, kodda yo'q) → 20-bo'lim; u kelguncha
tugma **yashiriladi**.

---

### 11.21 · New alert rule
📁 `Settings — immutable audit trail.jpg` · `alertRules` FULL · `md`

`New alert rule` / `Alerts are evaluated against live ELD telemetry`
- 2 ustun: `Rule name *` (`Break required soon`) · `Severity ▾` (`Warning` / `Critical` / `Info`)
- **`CONDITION`** — shart quruvchi (`--border` karta):
  `When [30-minute break ▾] is due within [30 minutes ▾] for [any driver ▾]`
  `And  [vehicle status ▾] is [Driving ▾]` + o'ngda `✕ Remove` (danger link)
  punktir tugma `+ Add a condition`
- **`DELIVERY`** — checkbox qatori: ☑ `In-app` · ☑ `Email` · ☐ **`SMS`** (**doim disabled**,
  tooltip `SMS is not available`) · ☐ `Webhook`
- 2 ustun: `Recipients ▾` (`Assigned fleet manager` / `Fleet managers` / `Dispatchers` /
  `Safety team` / `Specific users…`) · `Repeat ▾` (`Once per driver per day` / `Every occurrence` /
  `Once per hour`)
- Toggle kartasi: `Quiet hours` / `Hold non-critical alerts between 22:00 and 06:00 local time` — ✅
- Footer: ☑ `Enable the rule immediately` · `Cancel` · `▷ Test rule` · **`Create rule`**

`POST /alert-rules` (`conditions`, `channels`, `recipients`, `throttle`, `quietHours`).
`SMS` hech qachon `channels` ga qo'shilmaydi (server `422 CHANNEL_NOT_AVAILABLE` qaytaradi).
`Test rule` — ⚠️ endpoint yo'q → 20-bo'lim; yo'q bo'lsa tugma yashiriladi.

---

### 11.22 · New support ticket
📁 `Reports — FMCSA : DOT pack and eRODS transfer.jpg` · `support` · `md`

`New support ticket` / `Average first response 42 minutes`
- 2 ustun: `Category * ▾` (`ELD hardware`, `HOS & logs`, `Reports`, `Billing`, `Other`) ·
  `Priority * ▾` (`Urgent — vehicle down`, `High`, `Normal`, `Low`)
- `Subject *`
- 2 ustun: `Related unit ▾` · `Related driver ▾`
- `Description *` — textarea (4 qator)
- Dropzone: `Attach screenshots, logs or photos` / `PNG, JPG, PDF or LOG · up to 10 MB each`
- 2 checkbox: ☑ `Include device diagnostics` · ☑ `Include the last 24 h of ELD events`
- Footer: chapda muted `Contact: sarah.chen@universal-logistics.com` · `Cancel` · **`Submit ticket`**

`POST /support/tickets`.

---

### 11.23 · Filters (o'ng drawer)
📁 `Real-time GPS map, vehicle list, unit detail card.jpg` · drawer 380 px

`Filters` / `Vehicles · 3 filters applied`; o'ngda `X`.
Guruhlar (har biri ostida 1px ajratkich, sarlavha `--fs-nav-section`):
- `STATUS` — checkbox: ☑ `Driving` · ☑ `Idle` · ☐ `Off duty` · ☑ `ELD offline` · ☐ `Inactive`
- `ELD DEVICE` — ☑ `Pacific Track` · ☐ `Pacific Track` *(dizaynda takror — ikkinchisi
  **`PT40`** bo'lishi kerak)* · ☐ `Not assigned`
- `MAKE` — ☐ `Freightliner` · ☐ `Kenworth` · ☐ `Peterbilt` · ☐ `Volvo`
- 2 ustun: `Year from ▾` (`2018`) · `Year to ▾` (`2025`)
- `Home terminal ▾` (`All terminals`)
- 2 ta toggle kartasi: `Only units with open defects` (⬜) · `Only units with firmware out of date` (✅)
- Footer (sticky): `↺ Reset all` (secondary) · **`✓ Apply 3 filters`** (primary, to'liq kenglik)

Qo'llangan filtrlar **URL query'ga** yoziladi (shareable). `Filters` tugmasida son ko'rinadi.
Har bir ekranning o'z filtr to'plami bor (Drivers: status, terminal, violations, exemptions;
DVIR: type, severity, repair status; Safety: event type, severity, coaching status).

---

### 11.24 · Table settings (popover)
📁 `Password reset, two-factor, new password.jpg` · popover 280 px, ustun ikonkasidan

`Table settings` + o'ngda `Reset` (link).
- **`SAVED VIEWS`** — radio qatorlar: ✓ `All vehicles` · `ELD offline > 30 min` ·
  `Service due this month` · `Unassigned units`; har birida `…` (`Rename`, `Duplicate`, `Delete`);
  pastda `+ Save the current view` (`--primary`)
- **`COLUMNS`** — drag qatorlar (`⣿` ushlagich + nom + o'ngda toggle):
  `Unit #` — **`Locked`** chipi (o'chirib bo'lmaydi) · `Status` ✅ · `Driver` ✅ ·
  `Make & model` ✅ · `Year` ✅ · `VIN` ✅ · `ELD serial` ✅ · `Odometer` ✅ ·
  `Last seen` ⬜ · `Home terminal` ⬜ · `Fuel type` ⬜
- Footer: `Cancel` · **`Apply`**

Saqlanadi: `localStorage['obk.table.<screen>']` (ustunlar) va **saved views ham localStorage**
(⚠️ backendda saqlash uchun endpoint yo'q → 20-bo'lim, kelajakda `/me/preferences`).

---

### 11.25 · Date range picker (popover)
📁 `Personal account — profile, security, sessions.jpg` · popover ~620 px

Chapda `PRESETS` ustuni (168 px): 5.12-bo'limdagi ro'yxat; faol preset `--primary`.
O'ngda **ikki oylik** kalendar (`September 2025` / `October 2025`), har birida `‹ ›`.
Tanlangan oraliq: chekka kunlar to'q ko'k doira (oq matn), oradagi kunlar `--primary-soft` fon.
Pastda 2 ta input (`Sep 03, 2025` → `Sep 10, 2025`) + chapda `8 days selected`;
o'ngda `Cancel` · **`✓ Apply range`**.
Kelajak kunlar disabled. `Last 8 days (HOS)` tanlanganda **aynan 8 kun** (bugun + 7).

---

### 11.26 · Account menu (dropdown)
📁 `Settings — company profile and HOS ruleset.jpg` · avatar'dan, 260 px

- Yuqorida: 40 px avatar + `Sarah Chen` (600) + email (12 muted)
- Rol qatori: `● Admin` badge + `All terminals` (muted) + o'ngda `Switch role` (`--primary` link)
  > ⚠️ **`Switch role` v1 da yo'q** — olib tashlanadi (rol impersonatsiyasi xavfli va
  > backendda qo'llab-quvvatlanmaydi). 21.6-bo'limda.
- Punktlar: `My profile` · `Account security` · `Notification preferences`
- Ajratkich: `Switch organisation` (o'ngda `3`) — **disabled, `v2` chipi** ·
  `Language` (`English`) · `Appearance` (`Light`)
  > `Appearance` v1 da faqat `Light` (dark mode yo'q) — disabled.
- Ajratkich: `Help center` · `Keyboard shortcuts` (o'ngda `?`) · `What is new`
- Ajratkich: **`Sign out`** (danger)

---

### 11.27 · Notifications (panel)
📁 `Three-pane driver messaging with context panel.jpg` · bell'dan, 360 px

Header: `Notifications` + badge `4 new`; o'ngda `Mark all read` (link) + `Settings` (ikonka).
Segmentlar: `All 12` · `Violations 6` · `Maintenance 3`.
Element (chapda 32 px tipli ikonka, o'ngda nisbiy vaqt):
`HOS violation` / `John Smith exceeded the 11-hour driving limit by 00:26` — `2 min`
`ELD disconnected` / `Unit #110 · PT30_77D2 has been offline for 46 minutes` — `45 min`
`Break due soon` / `Marvin McKinney needs a 30-minute break in 00:18` — `1 h`
`Maintenance overdue` / `Unit #104 oil & filter service was due 2 days ago` — `3 h`
`Unassigned driving` / `1h 12m of driving with no driver logged in on unit #103` — `5 h`
`Report ready` / `FMCSA audit pack for Jun 2025 finished generating` — `Yesterday`
O'qilmagan — och ko'k fon. Pastda `View all notifications` (markazda, `--primary`).
Element bosilganda — tegishli ekranga o'tadi va `readAt` belgilanadi.
`GET /notifications`, `POST /notifications/read-all`.

---

### 11.28 · Command palette (⌘K)
📁 `Settings — back-office users and invitations.jpg` · markazda 560 px, yuqoridan 90 px

- Qidiruv qatori: `Search` ikonka + input (`smith`) + o'ngda `ESC` chipi
- Natijalar guruhlangan (`DRIVERS`, `VEHICLES`, `ACTIONS`), sarlavhalar `--fs-nav-section`:
  `DRIVERS` → `John Smith` / `Unit #101 · On duty · 1 violation · 1 warning` (o'ngda `Enter`) ·
  `Smith Rodriguez` / `Unit #133 · Off duty`
  `VEHICLES` → `Unit #101 · Freightliner Cascadia` / `VIN 1FUJGLDR8LLLL1234 · John Smith`
  `ACTIONS` → `Open HOS logs for John Smith` · `Request a log edit` ·
  `Send FMCSA pack to inspector` · `Add a vehicle`
- Pastki qator: `↑↓ navigate` · `↵ open` · `⌘K toggle`; o'ngda
  `Searching 69 units · 58 drivers · 1,284 logs`

Klaviatura: `↑↓` tanlash, `Enter` ochish, `Esc` yopish, `⌘K`/`Ctrl+K` almashtirish.
**Amallar ruxsatga qarab filtrlanadi** (`Request a log edit` faqat `hosEdit` FULL da).
⚠️ Global qidiruv endpointi backendda **yo'q** → v1 da parallel
`GET /drivers?q=` + `GET /vehicles?q=` (debounce 250 ms), amallar — lokal ro'yxat.
20-bo'limda `GET /search?q=` talab qilinadi.

---

### 11.29 · System states (dizayn tizimi sahifasi)
📁 `Reports — inspection and defect history.jpg` — ekran emas, **komponentlar katalogi**.
Tarkibi 5.10 va 5.11-bo'limlarga ko'chirilgan. Alohida route yaratilmaydi
(ixtiyoriy: `/__styleguide` faqat dev rejimida).

---

### 11.30 · Discard changes (tasdiq)
Dizaynda yo'q, lekin **majburiy**: har bir `dirty` forma modalini yopishda.
`sm`, `Discard changes?` / `Your edits will be lost.` · `Keep editing` · `Discard` (danger).
---

## 12. Rol bo'yicha to'liq matritsa

### 12.1. Ekran ko'rinishi

| Ekran | ADMIN | FLEET_MANAGER | DISPATCHER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| Fleet Dashboard | ✅ | ✅ | ✅ | ✅ o'qish |
| Live Fleet | ✅ | ✅ | ✅ | ✅ o'qish |
| Vehicles | ✅ | ✅ | ✅ o'qish | ✅ o'qish |
| Unit profile | ✅ | ✅ | ✅ o'qish + `Assign driver` | ✅ o'qish |
| Unit histories | ✅ | ✅ | ✅ | ✅ |
| Drivers | ✅ | ✅ | ✅ o'qish | ✅ o'qish |
| Driver profile | ✅ | ✅ | ✅ + `Message`/`Assign trip` | ✅ o'qish |
| Dispatch & Trips | ✅ | ✅ | ✅ **to'liq** | ❌ |
| HOS Logs | ✅ **+ Certify all** | ✅ | ✅ o'qish + Export | ✅ o'qish + Export |
| DVIR & Maintenance | ✅ | ✅ | ❌ | ✅ o'qish |
| Safety | ✅ | ✅ | ❌ | ✅ o'qish |
| Reports · IFTA | ✅ | ✅ | ✅ o'qish | ✅ o'qish |
| Reports · Activity | ✅ | ✅ | ✅ o'qish | ✅ o'qish |
| Reports · DVIR | ✅ | ✅ | ❌ | ✅ o'qish |
| Reports · FMCSA | ✅ | ✅ | ❌ | ❌ |
| Messages | ✅ | ✅ | ✅ | ❌ |
| Settings · Company | ✅ | ❌ | ❌ | ❌ |
| Settings · Users | ✅ | ❌ | ❌ | ❌ |
| Settings · Roles | ✅ | ❌ | ❌ | ❌ |
| Settings · ELD devices | ✅ | ✅ | ❌ | ❌ |
| Settings · Alert rules | ✅ | ✅ | ❌ | ❌ |
| Settings · Integrations | ✅ | ❌ | ❌ | ❌ |
| Settings · Audit log | ✅ | ❌ | ❌ | ❌ |
| Settings · Support | ✅ | ✅ | ✅ | ✅ |
| Support · Feedback | ✅ | ✅ | ✅ | ✅ |
| My profile | ✅ | ✅ | ✅ | ✅ |
| **Jami** | **26** | **21** | **14** | **16** |

Bu raqamlar `web/roles and screens/` papkalaridagi fayllar soniga **aynan mos** — nazorat nuqtasi.

### 12.2. Read-only rejimning universal qoidalari

Rol `READ` bo'lganda ekranda **quyidagilar butunlay olib tashlanadi** (disabled emas):

1. Asosiy CTA (`+ Add …`, `+ Create …`, `+ New …`, `Invite user`, `Register device`)
2. `Import` tugmasi
3. Jadval tanlash checkbox ustuni **va** header'dagi «hammasini tanlash»
4. Qator `…` menyusi ustuni
5. Bulk action bar (tanlov imkoni yo'q)
6. Karta ichidagi amal tugmalari (`Edit`, `Resolve`, `Certify all`, `Assign coaching`,
   `Calibrate odometer`, `New work order`, `Create work order`, `Schedule`, `Generate report`)
7. Detal sahifasidagi `Edit …` header tugmasi
8. Toggle'lar → statik badge (`Active` / `Muted`)
9. Forma inputlari → `readOnly` + `--bg-subtle` fon (agar forma baribir ko'rsatilsa)

**Qoladi:** navigatsiya, filtrlar, qidiruv, sort, pagination, `Export`, `Print`,
`Download PDF`, detal ochish, drawer'ni o'qish.

### 12.3. Rol chipi, avatar va demo akkauntlar

Chip qoidalari — 4.4-bo'lim.

**Dizayn rasmlaridagi foydalanuvchilar** (mock): `SC` Sarah Chen (Admin),
`MR` Mike Rowan (Fleet manager), `DF` Dana Ford (Dispatcher), `PN` Priya Nair (Viewer).

**Dev DB dagi haqiqiy demo akkauntlar** (§6.7 — QA va E2E shularni ishlatadi):
`sarah.chen@…` ADMIN · `mike.torres@…` FLEET_MANAGER · `carlos.ramirez@…` DISPATCHER ·
`diane.foster@…` VIEWER; parol hammasida `Onebook2026`.

### 12.4. Ruxsat yo'q holatlari

| Holat | Ko'rinish |
|---|---|
| Menyudan yashirilgan route'ga URL bilan kirish | To'liq sahifa: 56 px `--bg-subtle` doira + `Lock`; `You do not have access to this page`; `Ask an administrator if you need access to <Screen name>.`; `‹ Back to dashboard` |
| Amal bajarishda kutilmagan `403` | Error toast: `You do not have permission to do that.` + `traceId` (kichik, muted) |

### 12.5. Bulk action bar

Pastda markazda fixed, qora, `--radius-lg`, `--shadow-pop`, 56 px, `min-width: 520px`:
`N drivers selected` + amal tugmalari (ghost, oq) + o'ngda `X`.
Faqat `FULL` ruxsatda. Tanlov sahifa almashganda tozalanadi (yoki
`Select all 58` havolasi — v1 da **yo'q**, faqat joriy sahifa).

---

## 13. Holatlar va xabarlar

### 13.1. Har bir ekran uchun majburiy 4 holat

| Holat | Qoida |
|---|---|
| **Loading** | Skeleton — **spinner emas** (5.11). Karta tuzilishi saqlanadi, kontent kulrang bloklar. KPI qatori doim 4 ta skeleton karta |
| **Empty** | `<EmptyState>` — ikonka + sarlavha + tavsif + 1–2 amal. Har bir ekran uchun **o'z matni** (13.2) |
| **Error** | `<ErrorState>` karta ichida — butun sahifa emas. Bir karta tushsa, boshqasi ishlaydi |
| **Forbidden** | 12.4 |

### 13.2. Bo'sh holat matnlari (aynan)

| Ekran | Sarlavha | Tavsif | Amallar |
|---|---|---|---|
| Vehicles | `No vehicles yet` | `Add your first unit or import a CSV to start recording hours of service.` | `Import CSV` · `Add vehicle` |
| Drivers | `No drivers yet` | `Add drivers so they can sign in to the mobile app and start logging hours.` | `Import CSV` · `Add driver` |
| Live Fleet | `No units are reporting` | `Units appear here as soon as a driver connects to an ELD over Bluetooth.` | `View vehicles` |
| HOS Logs (kun) | `No ELD records for this day` | `The driver may have been off duty or the app was not signed in.` | — |
| HOS Logs (drayver tanlanmagan) | `Select a driver to view their log` | — | `<DriverPicker>` |
| DVIR | `No inspections in this period` | `Drivers submit pre-trip and post-trip inspections from the mobile app.` | `Change period` |
| Open defects | `No open defects` | `Every reported defect has been corrected.` | — |
| Safety | `No safety events` | `Harsh braking, acceleration and speeding events appear here as they are detected.` | — |
| Trips | `No active trips` | `Create a trip to dispatch a load to a driver.` | `Create trip` |
| Unassigned loads | `No loads waiting` | `Every load has a driver assigned.` | — |
| Messages | `No conversations yet` | `Start a conversation with a driver or send a broadcast to the fleet.` | `New` |
| Reports | `No reports generated yet` | `Generated reports are kept for 24 months.` | `Generate report` |
| Audit log | `No events match these filters` | `Try a wider date range or clear the filters.` | `Reset filters` |
| Notifications | `You are all caught up` | `New violations, alerts and reports appear here.` | — |
| Support | `No tickets yet` | `Open a ticket and our team replies within about four hours.` | `New ticket` |
| Qidiruv natijasi | `Nothing matches "<query>"` | `Check the spelling or try a unit number, VIN or username.` | `Clear search` |

### 13.3. Toast xabarlari (aynan)

| Amal | Turi | Sarlavha / tavsif |
|---|---|---|
| Unit yaratildi | ✅ | `Unit #126 created` / `ELD PT30_1C4F paired and the driver was notified.` |
| Unit o'chirildi | ✅ | `Unit #121 deleted` / `Historical logs and DVIRs are still available for audits.` |
| Drayver qo'shildi | ✅ | `Driver added` / `An invitation was sent to john@example.com.` |
| Import tugadi | ✅ | `38 units imported` / `36 created · 2 updated · 0 failed.` |
| Tuzatish so'rovi | ✅ | `Edit request sent` / `John Smith must accept it in the mobile app before the log changes.` |
| Sertifikatlandi | ✅ | `2 days certified` / `Certified on behalf of John Smith · written to the audit log.` |
| Segment biriktirildi | ✅ | `2 segments assigned` / `Hours were recalculated for the affected drivers.` |
| Transfer yuborildi | ✅ | `Transfer sent` / `The file was accepted by the FMCSA endpoint.` |
| Transfer TEST | ⚠️ | `Transfer completed in test mode` / `The file was not sent to FMCSA. Download a copy for the officer.` |
| Transfer xatosi | ❌ | `Data transfer failed` / `The FMCSA endpoint returned 503. Retry or send by email.` |
| Hisobot tayyor | ✅ | `Report ready` / `FMCSA audit pack · 24 MB` + `Download` amali |
| Sertifikatlanmagan | ⚠️ | `6 logs still uncertified` / `Two drivers have not signed logs for Sep 09 and Sep 10.` |
| Ruxsat yo'q | ❌ | `You do not have permission to do that.` |
| Tarmoq | ❌ | `Could not reach the server` / `Check your connection and try again.` + `Retry` |
| Sozlama saqlandi | ✅ | `Settings saved` |
| Qayta ulandi | ✅ | `Reconnected` / `Live data resumed.` (3 s) |

### 13.4. Offline va ulanish

`navigator.onLine === false` **yoki** WS uzilgan + oxirgi 2 ta so'rov muvaffaqiyatsiz →
`<OfflineBanner>` (5.11). Ulanish tiklanganda banner yo'qoladi, `Reconnected` toast chiqadi
va **joriy ekran to'liq invalidate** bo'ladi (7.2, 3-band).

Offline holatda: `GET` — keshdan ko'rsatiladi (`staleTime` e'tiborga olinmaydi),
barcha `POST/PATCH/DELETE` tugmalari **disabled** + tooltip `You are offline`.
Web panelda **offline navbat yo'q** (bu faqat mobil ilova talabi, `backend/tz.md` §13).
---

## 14. Formalar va validatsiya

### 14.1. Umumiy qoidalar

1. **`react-hook-form` + `zod`**, `mode: 'onBlur'`, qayta validatsiya `onChange`
2. Majburiy maydon — yorliqdan keyin qizil `*`
3. Xato: input chegarasi `--danger`, ostida 12/400 `--danger` matn, `aria-invalid`,
   `aria-describedby`
4. Yuborishda birinchi xato maydoniga **scroll + fokus**
5. Yuborish jarayonida: tugma `loading`, barcha inputlar `disabled`
6. Server `422` → `details` dagi maydonlar `setError`; noma'lum maydon → modal banneri
7. **Ikki marta yuborish taqiqlanadi** (tugma `disabled` + `isSubmitting` gvardi)
8. Modal yopilishida `dirty` bo'lsa 11.30 tasdig'i

### 14.2. Maydon qoidalari (backend DTO'lari bilan mos)

> Web panelda **back-office foydalanuvchisi uchun parol maydoni yo'q** (faqat Google).
> Quyidagi jadvaldagi yagona parol qatori — `Add driver` modalida admin drayver uchun
> yaratadigan **mobil ilova paroli**.

| Maydon | Qoida | Xato matni |
|---|---|---|
| Email | RFC-lite regex | `Enter a valid email address.` |
| Inspektor email | `*.fmcsa.dot.gov` | `Only fmcsa.dot.gov addresses are accepted.` |
| Parol (driver, `Add driver` modali) | min 8 | `Use at least 8 characters.` |
| VIN | 17 belgi, `[A-HJ-NPR-Z0-9]` | `A VIN is 17 characters and cannot contain I, O or Q.` |
| Unit number | 1–20, unikal | `A unit with this number already exists.` |
| Username | 3–30, `[a-z0-9._-]`, unikal | `Usernames may contain lowercase letters, numbers, dots, dashes and underscores.` |
| CDL number | 1–20 | `Enter the driver licence number.` |
| Odometer | butun, `0 … 3 000 000` | `Enter the odometer in miles.` |
| `outputFileComment` | 1–**60** | `Maximum 60 characters.` |
| Annotation (log/unidentified) | **4**–60 | `An annotation must be at least 4 characters (FMCSA requirement).` |
| Edit reason | 4–500 | `Explain why the record is being changed.` |
| Message body | 1–2000 | `Messages are limited to 2,000 characters.` |
| Ticket subject | 3–140 | — |
| `eldIdentifier` | **aynan 4**, `[A-Z0-9]` | `The ELD identifier is exactly 4 characters.` |
| Sana oralig'i (transfer) | ≤ **8 kun** | `A transfer covers at most 8 days.` |
| Sana oralig'i (log range) | ≤ **62 kun** | `Select a range of 62 days or fewer.` |
| Fayl (CSV) | ≤ 5 MB, `.csv` | `Upload a CSV file up to 5 MB.` |
| Fayl (rasm) | ≤ 5 MB, `image/*`, max 5 ta | `Up to 5 images, 5 MB each.` |
| Telefon | E.164 yoki AQSh formati | `Enter a valid phone number.` |

### 14.3. Xato kodlari → foydalanuvchi matni

`shared/api/errors.ts` — backend `ERROR_CODES` bilan bir-bir mos:

| Kod | Matn |
|---|---|
| `DRIVING_TIME_IMMUTABLE` | `Driving time can never be shortened, deleted or restatused (49 CFR §395.30).` |
| `RECERTIFICATION_REQUIRED` | `The log changed after the last certification — it must be certified again.` |
| `DRIVER_NOT_FOUND` | `Driver not found.` |
| `RANGE_TOO_LARGE` | `The selected range is too large.` |
| `INVALID_TRANSFER_RECIPIENT` | `Only fmcsa.dot.gov addresses are accepted.` |
| `CHANNEL_NOT_AVAILABLE` | `SMS is not available — this rule will be delivered by email.` |
| `UNRESOLVED_UNIDENTIFIED` | `Resolve the unassigned driving segments first.` |
| `UNCERTIFIED_LOGS` | `Some logs in this range are not certified.` |
| `ACTIVE_MALFUNCTION` | `An ELD malfunction is active for this driver.` |
| `ERODS_TEST_MODE` | `eRODS is in test mode — the file will not reach FMCSA.` |
| `USER_NOT_INVITED` | `This account is not invited to the panel.` |
| `EMAIL_NOT_VERIFIED` | `Verify your email address first.` |
| `CONFLICT` (409) | Kontekstga qarab (`A unit with this number already exists.`) |
| Noma'lum | `Something went wrong. Reference: <traceId>` |

---

## 15. Accessibility

Maqsad — **WCAG 2.1 AA**.

| Talab | Amalga oshirish |
|---|---|
| Kontrast | Barcha matn ≥ 4.5:1, katta matn ≥ 3:1. `--text-muted` (#94A3B8) **oq fonda 2.8:1** — shu sababli u faqat **12 px dan katta ikkilamchi matn** uchun va hech qachon yagona ma'lumot tashuvchisi emas |
| Rang yagona signal emas | Har bir status badge'da **matn** bor (`Critical`, `On-duty`); grafiklarda legend + qiymat |
| Klaviatura | Barcha interaktiv element `Tab` bilan; modal — focus trap; `Esc` yopadi; jadval qatori `Enter` bilan ochiladi |
| Fokus ko'rinishi | `outline: 2px solid var(--border-focus); outline-offset: 2px` — **hech qachon `outline: none`** |
| Skip link | `Skip to content` — `Tab` bosilganda birinchi element |
| Landmark | `<nav aria-label="Main">`, `<main>`, `<aside aria-label="Context">` |
| Jadval | `<table>` semantikasi, `<th scope="col">`, `aria-sort`, `<caption class="sr-only">` |
| Dinamik yangilanish | Toast `role="status" aria-live="polite"`; xato `role="alert" aria-live="assertive"`; jadval yangilanishi `aria-live="polite"` bilan e'lon (`9 rows updated`) |
| Forma | Har bir input `<label for>`; xato `aria-describedby`; guruh `<fieldset><legend>` |
| Ikonka tugma | `aria-label` (`aria-label="Refresh data"`) |
| Xarita | Klaviatura bilan boshqarilmaydi → **matnli muqobil majburiy**: Live Fleet chap ustuni to'liq klaviatura bilan ishlaydi va bir xil ma'lumot beradi |
| 24-soatlik grid | `role="img"` + `aria-label` (`Duty status graph for Wed, Sep 10: off duty 7 hours 30 minutes, sleeper 2 hours, driving 11 hours 26 minutes, on duty 3 hours 4 minutes`) + ostida `sr-only` jadval |
| Harakat | `prefers-reduced-motion` — animatsiyalar o'chadi (toast, drawer, route replay) |
| Zoom | 200% zoom'da kontent kesilmaydi (gorizontal scroll ruxsat) |

**Test:** har bir PR da `axe-core` (Vitest + Playwright) — 0 ta `critical`/`serious`.

---

## 16. Performance

### 16.1. Bundle budjeti (gzip)

| Chunk | Limit |
|---|---|
| Boshlang'ich (entry + vendor + shell) | **≤ 220 KB** |
| Har bir route chunk | ≤ 90 KB |
| MapLibre (lazy) | ≤ 250 KB — **faqat xarita ekranida** |
| Recharts (lazy) | ≤ 120 KB |
| Umumiy (barcha chunk) | ≤ 1.2 MB |

CI da `rollup-plugin-visualizer` + budjet tekshiruvi; oshsa build **tushadi**.

### 16.2. Runtime maqsadlari (1280×800, Fast 3G emas, ofis Wi-Fi)

| Ko'rsatkich | Maqsad |
|---|---|
| Birinchi kontent (login sahifasi) | LCP < 1.5 s |
| Dashboard interaktiv (kesh bilan) | < 1.0 s |
| Dashboard interaktiv (sovuq) | < 2.5 s |
| Route almashish | < 300 ms (skeleton darhol) |
| Jadval sort/filtr (kesh) | < 100 ms |
| Modal ochilishi | < 100 ms |
| Xarita birinchi render (69 marker) | < 1.5 s |
| WS hodisadan UI yangilanishigacha | < 200 ms |
| 24-soatlik grid render | < 50 ms |

### 16.3. Qoidalar

1. **Route-level code splitting** — har bir `features/*` `React.lazy`
2. MapLibre, Recharts, Puppeteer-siz PDF yo'q — **lazy import**
3. Jadval: 300 qatorgacha oddiy render; `> 500` bo'lsa `@tanstack/react-virtual`
   (hozircha faqat `Audit log` va `Log events` — ular serverdan sahifalanadi)
4. `React.memo` faqat o'lchangan muammoda; `useMemo` — og'ir hisoblarda (grid segmentlari)
5. Xarita markerlari — **GeoJSON source + symbol layer**, DOM marker emas (69→300 unit)
6. WS hodisalari — 200 ms `throttle`, `queryClient.setQueryData` bilan **nuqtali** yangilash
   (butun ro'yxatni invalidate qilmaslik)
7. Rasm: DVIR fotolari `loading="lazy"`, thumbnail presigned URL
8. `refetchInterval` faqat `document.visibilityState === 'visible'` bo'lganda

---

## 17. Xavfsizlik (frontend)

| Chora | Amalga oshirish |
|---|---|
| CSP | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <tile-host> <s3-host>; connect-src 'self' <api-host> <ws-host> <tile-host>; frame-ancestors 'none'` |
| XSS | `dangerouslySetInnerHTML` **taqiqlanadi** (ESLint `react/no-danger: error`). Markdown yo'q |
| Token | Access — xotirada; refresh — `localStorage`; **hech qachon URL'da** |
| Logout | Token tozalanadi, `queryClient.clear()`, socket uziladi, `/sign-in` |
| Avtomatik logout | 30 daqiqa harakatsizlikdan keyin ogohlantirish modali (60 s taymer), keyin logout |
| Presigned URL | Hech qachon loglanmaydi, keshlanmaydi (`Cache-Control: no-store`) |
| Fayl yuklash | MIME + kengaytma + hajm tekshiruvi klientda ham, serverda ham |
| Clickjacking | `frame-ancestors 'none'` |
| Sentry | `beforeSend` — token, email, VIN, CDL raqami **maskalanadi** |
| PII loglanmaydi | `console.log` prod build'da olib tashlanadi (`esbuild drop`) |
| Bog'liqliklar | `npm audit --production` CI da; `high`+ → build tushadi |
---

## 18. Testlash

| Daraja | Qamrov | Vosita | Nima tekshiriladi |
|---|---|---|---|
| Unit — `shared/format` | **100%** | Vitest | mi/gal/mph, HH:MM, DST, home-terminal mintaqasi, nisbiy vaqt |
| Unit — `shared/auth/permissions` | **100%** | Vitest | 22 kalit × 4 rol × 3 daraja |
| Unit — boshqa | ≥ 80% | Vitest | hooks, reducerlar, grid segment matematikasi |
| Komponent | Asosiy | Testing Library | `DataTable` (sort/pagination/tanlov), `HosMeter` rang chegaralari, `Modal` focus trap, `EmptyState` |
| **Kontrakt** | **100% ishlatiladigan endpoint** | MSW + `openapi.json` | Har bir so'rov/javob backend sxemasiga mos; sxema o'zgarsa test tushadi |
| **RBAC** | **4 rol × 26 ekran** | Testing Library | Har bir rol uchun ko'rinadigan/ko'rinmaydigan elementlar ro'yxati (12-bo'lim jadvali test fikstyurasi) |
| E2E | Kritik oqimlar | Playwright | Quyida |
| A11y | Har bir ekran | axe-core | 0 critical/serious |
| Vizual | 26 ekran × 4 rol | Playwright screenshot | Dizayn rasmi bilan qo'lda taqqoslash (baseline) |

### 18.1. E2E ssenariylari (majburiy)

1. **`dev` rejimi:** 4 ta demo akkaunt (§6.7) bilan kirish → har bir rol o'z sidebar'ini
   ko'radi; `Demo accounts` linki maydonlarni to'ldiradi
2. **`production` rejimi:** `Continue with Google` → Dashboard; taklif qilinmagan
   Gmail → `USER_NOT_INVITED` banneri; popup bloklanganda `signInWithRedirect`
3. **`production` build'da email/parol formasi bundle'da ham yo'q** (regressiya testi:
   `dist/` ichida `Developer sign-in` matni topilmasligi kerak)
4. *(bekor qilingan — 2FA olib tashlandi, Q-4)*
5. **Rol bo'yicha navigatsiya** — 4 rol uchun sidebar tarkibi 4.2-jadvaliga mos
6. **Drayver yaratish** — `+ Add driver` → `Email address` majburiy va unikal →
   yaratilgan drayver `Drivers` jadvalida ko'rinadi (§6.8)
7. **Unit qo'shish** → jadvalda ko'rinadi → tahrirlash → o'chirish (tasdiq matni bilan)
8. **CSV import** — 38 qator, natija xulosasi
9. **HOS Logs** — drayver tanlash → sana o'zgartirish → grid to'g'ri segmentlar →
   `Request a log edit` → `DRIVING_TIME_IMMUTABLE` xatosi ko'rsatiladi
10. **Certify all** — faqat ADMIN ko'radi; FM'da tugma yo'q
11. **Unassigned driving** — 2 segment biriktirish → toast → hisoblagich kamayadi
12. **FMCSA pack → Send to inspector** — TEST rejimi banneri → transfer ro'yxatida `Test only`
13. **Real-time** — WS orqali `trip.status_changed` → jadval qatori yangilanadi
14. **Offline** — tarmoq uzilganda banner, tugmalar disabled, tiklanganda refetch
15. **Read-only** — Viewer 16 ekranda hech qanday yozuv tugmasi ko'rmaydi
16. **SMS yo'qligi** — Alert rules'da `SMS` kanali bosilmaydi; API ga `SMS` yuborilmaydi

### 18.2. Vizual nazorat

Har bir ekran uchun `web/roles and screens/` rasmi **baseline** hisoblanadi. PR da
Playwright skrinshoti olinadi va reviewer ikkalasini yonma-yon taqqoslaydi.
**Piksel-diff avtomatlashtirilmaydi** (mock va real ma'lumot farq qiladi), lekin
tekshiriladi: layout tuzilishi, ustunlar tartibi va nomlari, badge ranglari,
tugma matnlari, bo'sh holat matnlari.

---

## 19. Bosqichlar

| # | Bosqich | Tarkib | Natija |
|---|---|---|---|
| **1** | Poydevor | Vite skeleton, tokenlar, `shared/ui` (5-bo'lim), `client.ts`, auth, RBAC, AppShell, router, MSW | Login → bo'sh Dashboard, 4 rol uchun to'g'ri sidebar |
| **2** | Dashboard + Live Fleet | KPI, donut, xarita, unit kartochkasi, WS ulanish | W-01, W-02 |
| **3** | Fleet | Vehicles, Unit profile, Drivers, Driver profile + 11.2–11.8 modallari | W-03, W-04, W-06, W-07 |
| **4** | ⭐ HOS | 24-soatlik grid, Available hours, Certification, Log events + 11.11–11.13 | W-08 |
| **5** | Compliance | DVIR & Maintenance, defektlar, ish buyurtmalari + 11.15–11.17 | W-09 |
| **6** | Operatsiya | Dispatch & Trips, Safety, Messages + 11.10 | W-10, W-11, W-16 |
| **7** | Hisobotlar | IFTA, Activity, DVIR, **FMCSA pack + transfer** + 11.14 | W-12…W-15 |
| **8** | Sozlama | Company, Users, Roles, Devices, Alerts, Integrations, Audit, Support, Feedback + 11.18–11.22 | W-17…W-25 |
| **9** | Hisob va overlay'lar | My profile, sessiyalar, Command palette, Notifications, Table settings, Filters | W-26, 11.23–11.28 |
| **10** | Qattiqlashtirish | A11y, performance budjeti, vizual nazorat, E2E to'liq, Sentry, CSP | Prod'ga tayyor |

**Bog'liqlik:** 4-bosqich (HOS) `GET /drivers/:id/hos` **yoki** joriy holat endpointisiz
to'liq bitmaydi; 2-bosqich `GET /live/fleet` siz vaqtinchalik yechimda ishlaydi;
3-bosqich `GET /drivers/roster` siz **relizga chiqmaydi** (20.1-jadval).

---

## 20. Backendda kerak bo'ladigan o'zgarishlar ⭐

Bu ro'yxat — web ishlashi uchun **majburiy** backend ishi. Har biri qaysi ekranni bloklashi
bilan yozilgan. Backend jamoasi bilan kelishilishi va `backend/tasks.md` ga ko'chirilishi kerak.

### 20.1. Bloklovchi (ularsiz ekran chiqmaydi)

| # | Endpoint | Nima uchun | Bloklaydi | Taklif qilinayotgan javob |
|---|---|---|---|---|
| B-1 | `GET /drivers/roster` (yoki `GET /drivers?include=hos`) | `GET /drivers` faqat `Driver` qatorini beradi — HOS soatlari, duty status, unit, ochiq buzilishlar yo'q | **W-06 Drivers** | `{ items: [{ driver, dutyStatus, unit, hos: {driveRemainingSec, shiftRemainingSec, cycleRemainingSec}, openViolations }], page, limit, total }` |
| B-2 | `GET /drivers/:id/hos` | Joriy HOS holati (`computeHos` natijasi). `tz.md` §11.3 da bor, kodda yo'q | **W-07** `Hours of service · right now`, W-16 kontekst paneli | `HosState` (tz.md §8.1) |
| B-3 | `GET /live/fleet` | 300 unit uchun bitta so'rovda joylashuv+status+HOS. D-044 tasdiqlaydi: yo'q | **W-02 Live Fleet**, W-01 xaritasi | `{ items: [{ vehicleId, unitNumber, driver, dutyStatus, lat, lon, speedMph, headingDeg, odometerMi, bleState, driveRemainingSec, shiftEndsAt, lastSeenAt }], generatedAt }` |
| B-4 | `GET /vehicles/:id/histories?date=` | Kunlik segmentlash (drive/stop/idle) serverda. Telemetriyani brauzerga tortish mumkin emas | **W-05 Histories** | `{ date, timezone, kpi: {...}, summary: {...}, segments: [{type,startAt,endAt,durationSec,from,to,distanceMi,odometerMi,driverId}], polyline }` |
| B-5 | `GET /vehicles/:id/activities` | Unit faoliyat jurnali | W-04 `Unit activity` | `{ items: [{ at, activity, driverId, source, details }], ... }` |
| B-6 | `POST /violations/:id/resolve` va `GET /violations` | `HosViolation` uchun endpoint umuman yo'q; hozir faqat `logs` javobi ichida | W-08 `Resolve`, W-01 `View all` | `{ id, status: 'RESOLVED', resolvedAt, resolutionNote }` |

### 20.2. Muhim (ekran ishlaydi, lekin funksiya yo'q)

| # | Endpoint / o'zgarish | Bloklaydi |
|---|---|---|
| B-7 | `GET /co-driver-pairings?vehicleId=&active=` va `POST` / `POST /:id/end` | W-04 `Co-driver` qatori, 11.2/11.4 `Co-driver` maydoni |
| B-8 | `GET /devices/:id/diagnostics` | 11.20 `Test connection` |
| B-9 | `POST /alert-rules/:id/test` | 11.21 `Test rule` |
| B-10 | `GET /search?q=` (global) | 11.28 Command palette (hozir 2 ta parallel so'rov) |
| B-11 | `GET/PUT /me/preferences` | 11.24 saved views va ustun tanlovi (hozir `localStorage`) |
| B-12 | `POST /support/tickets` — `support:READ` ga ham ruxsat | W-24 Viewer'da `New ticket` |
| B-13 | `POST /vehicles/:id/assign-driver` — `vehicles:FULL` **yoki** `trips:FULL` | W-04 Dispatcher'da `Assign driver` |
| B-14 | `ReportType` ga `RODS` va `IDLE_FUEL` qo'shish | W-12 Report library'dagi 2 punkt |
| B-15 | `Geofence` ga `dwellMinutes`, `afterHoursOnly` maydonlari | 11.1 ikkita checkbox |
| B-16 | Vehicle/Driver `Documents` (S3 + metadata) | W-04 `Documents` tab'i |
| **B-25** | **`AUTH_MODE=dev\|production`** env bayrog'i. `production` da `POST /auth/login` → `403 PASSWORD_LOGIN_DISABLED`; `dev` da ochiq | §6.6 — Google-only qarorini server tomonda majburlash |
| ~~B-26~~ | ⛔ **Bekor qilindi (Q-4)** — `TWO_FACTOR_ENFORCED` kerak emas. Prod'ga o'tishda birinchi admin **haqiqiy Gmail** bilan bo'lishi shart (`authProvider = GOOGLE`) | — |
| **B-27** | Taklifnoma email shabloni — havola parol o'rnatishga emas, `Sign in with Google` ga | 11.18 `Invite a user` |
| ~~B-28~~ | ⛔ **Bekor qilindi (Q-4)** — 2FA yo'q, `reset-two-factor` kerak emas | — |
| **B-29** | **`POST /auth/login/driver`** — identifikator sifatida `username` **yoki `email`** ni qabul qilsin | §6.8 — drayver Gmail bilan kiradi |
| **B-30** | **`Driver.email` → majburiy va `@unique`** (migratsiya + mavjud 58 seed drayveriga email backfill) | §6.8, 11.8, W-06. **Hozir dev DB da 58 drayverning hech birida email yo'q** |
| **B-31** | `Driver.emailVerifiedAt` maydoni + `POST /drivers/:id/send-verification` va tasdiqlash havolasi | Prod'ga o'tish: tasdiqlangan Gmail bilan kirish |
| **B-32** | Prod'da drayver uchun ham Google Sign-In (mobil) — `POST /auth/google/driver` | Prod'da drayver parolsiz kiradi |
| **B-33** *(ixtiyoriy)* | Seed ismlarini dizayn rasmlariga moslash (`Mike Rowan`, `Dana Ford`, `Priya Nair`) | Vizual taqqoslashni osonlashtiradi |

### 20.3. Real-time (7.4-bo'lim)

| # | Hodisa | Bloklaydi |
|---|---|---|
| B-17 | `fleet.position` | Live Fleet — hozir 30 s polling |
| B-18 | `hos.updated` | Dashboard/Drivers soatlari |
| B-19 | `violation.created`, `unidentified.created` | Dashboard feed, sidebar badge |
| B-20 | `dvir.submitted`, `defect.created` | DVIR ekrani |
| B-21 | `edit_request.created` / `.resolved` | HOS Logs |
| B-22 | `device.backlog` | ELD devices `Queued` ustuni |
| B-23 | WS `resume` + `seq` (tz.md §12.3) | Uzilishdan keyin to'liq refetch o'rniga delta |
| B-24 | WS token yangilash (`auth.renew`) | Hozir socket qayta ulanadi |

### 20.4. Kelishuv talab qiladigan savollar

1. **API versiyasi:** `/api/...` (kod) yoki `/api/v1/...` (tz.md)? Web `VITE_API_BASE_URL`
   bilan ikkalasiga ham tayyor, lekin **bir marta hal qilinishi** kerak.
2. **Terminal scoping:** `Terminal` filtri faqat UI filtri (hozirgi holat) yoki xavfsizlik
   chegarasi bo'ladimi? `User` da `terminalAccess` maydoni yo'q, lekin UI (`Terminal access`
   maydoni 11.18) uni ko'rsatadi. **Hozircha faqat ko'rsatma sifatida saqlanadi.**
3. **`Switch role`** (11.26) — impersonatsiya kerakmi? Tavsiya: **yo'q**.
4. **Vehicle groups** (`All vehicle groups ▾`) — backendda guruh modeli yo'q.
   v1 da dropdown faqat `All vehicle groups` bilan (disabled) yoki `Home terminal` bo'yicha.
5. ⭐ **Google Workspace domeni cheklovimi?** Faqat `@universal-logistics.com` domenidagi
   hisoblarga ruxsat berilsinmi (ID token'dagi `hd` claim tekshiruvi), yoki taklif qilingan
   istalgan Gmail bo'ladimi? Hozir TZ **ikkinchisini** nazarda tutadi (taklifnoma yetarli).
6. ⭐ **Admin Google hisobini yo'qotsa** zaxira kirish yo'li kerakmi? Tavsiya: backendda
   `npm run admin:create -- --email=<gmail>` skripti (server konsolidan, audit yozuvi bilan).
7. ⭐ **Drayver taklifnomasi** endi email orqali ketadi. `Driver.email` hozir **ixtiyoriy**
   (`email String?`). Taklifnoma yuborish uchun u **majburiy** bo'lishi kerakmi?
   Tavsiya: `Send invitation now` belgilangan bo'lsa — majburiy (frontend validatsiyasi).
---

## 21. Dizayn ↔ TZ nomuvofiqliklari va qarorlar

Dizayn rasmlari, `backend/tz.md` va buyurtmachi qarorlari bir-biriga zid bo'lgan
**9 ta joy**. Har biri uchun qaror va sabab.

> ⭐ Eng muhim ikkitasi — **21.1 (faqat Google orqali kirish)** va **21.5 (SMS yo'q)** —
> buyurtmachining 2026-09-12 dagi qarori; ular dizayndan ham, `backend/tz.md` dan ham
> ustun turadi.

### 21.1. Sign in — ⭐ prod'da faqat Google, dev'da parol ham (buyurtmachi qarori, 2026-09-12)

**Dizayn:** `Work email` + `Password` formasi, `Forgot password?`,
`Keep me signed in for 30 days`, va `Continue with SAML single sign-on`.
**TZ (backend):** SAML olib tashlangan, Google Sign-In qo'shilgan, parol ham qolgan.
**Buyurtmachi qarori:** **prod'da faqat Google (Gmail)**; hozircha (dev) haqiqiy Gmail
shart emas — seed akkauntlari parol bilan kiradi.

| Element | `dev` | `production` |
|---|---|---|
| `Continue with Google` | ✅ bor | ✅ **yagona amal** |
| `Work email` + `Password` + `Sign in` | ✅ **`Developer sign-in` yig'iluvchi bloki ichida** | ⛔ bundle'da ham yo'q |
| `Forgot password?` | ⛔ | ⛔ |
| `Keep me signed in for 30 days` | ⛔ (sessiya refresh token bilan — 30 kun) | ⛔ |
| `Continue with SAML single sign-on` | → **`Continue with Google`** | → **`Continue with Google`** |
| `/forgot-password`, `/reset-password` | ⛔ qurilmaydi | ⛔ qurilmaydi |
| `My profile › Security` parol gridi | ⛔ → `Sign-in method` kartasi | ⛔ → `Sign-in method: Google account` |

**Nima o'zgarmaydi:** taklifnomasiz kirish yo'q
(`USER_NOT_INVITED`).

**Backendga ta'siri:** `AUTH_MODE` bayrog'i (B-25).
Prod'da `POST /auth/login` → `403 PASSWORD_LOGIN_DISABLED`.

**Prod'ga o'tish cheklisti:** (1) barcha back-office foydalanuvchilarining email'i haqiqiy
Gmail'ga o'zgartiriladi · (2) `AUTH_MODE=production` ·
(3) `VITE_AUTH_MODE=production` bilan qayta build · (4) kamida bitta admin Google bilan
kira olishi tekshiriladi · (5) drayverlarning Gmail'lari tasdiqlanadi (§6.8).

### 21.2. Dispatcher'da DVIR va Safety menyusi
**Dizayn:** dispetcher sidebar'ida `DVIR & Maintenance` va `Safety` **yo'q** (14 ekran).
**TZ:** §6.4 matritsasi ikkalasiga `READ` beradi.
**Qaror:** **dizayn ustun** — menyu punkti ko'rsatilmaydi, route `403`.
Backend matritsasi o'zgarmaydi (`READ` qoladi — keyinchalik ochish arzon bo'ladi).
**Sabab:** 0-bo'limdagi ustuvorlik tartibi: skrinshotlar > tz.md.

### 21.3. Dispatcher'da `Assign driver` (unit sahifasi)
**Dizayn:** dispetcher `Unit profile` da `Assign driver` tugmasini ko'radi.
**TZ:** `vehicles = READ`, endpoint `vehicles:FULL` talab qiladi.
**Qaror:** tugma **qoladi**; backend `POST /vehicles/:id/assign-driver` ni
`vehicles:FULL || trips:FULL` ga o'zgartirishi kerak (B-13).
Bajarilmaguncha frontend `403` ni toast bilan ko'rsatadi.
**Sabab:** haydovchini unitga biriktirish — dispetcherlik amali; dizayn shuni tasdiqlaydi.

### 21.4. Viewer'da `New ticket`
**Dizayn:** viewer `Settings · Support` da `+ New ticket` ni ko'radi.
**TZ:** `support = READ`.
**Qaror:** tugma **qoladi**; `READ` ning istisnosi — **har kim o'z tiketini ocha oladi**.
Backend `POST /support/tickets` ni `support:READ` ga ochishi kerak (B-12).
**Sabab:** yordam so'rash huquqi ruxsat darajasiga bog'liq emas.

### 21.5. ⭐ SMS umuman ishlatilmaydi (buyurtmachi qarori, 2026-09-12)

**Dizayn:** 11.7 va 11.8 da `receives an SMS with…`; Alert rules'da `SMS · v2 · coming soon`.
**TZ:** §14 — SMS v1 da yo'q, API `SMS` ni `422 CHANNEL_NOT_AVAILABLE` bilan rad etadi.
**Buyurtmachi qarori:** SMS **hozircha umuman yo'q** — hamma xabar **email** orqali.

| Joy | Qaror |
|---|---|
| 11.7 `Import drivers` | `Each driver receives an **email** with a one-time sign-in code` |
| 11.8 `Add driver` info banneri | `The driver receives an **email** with the app download link and a one-time sign-in code.` |
| Alert rules · `Notification channels` | `SMS` qatori **ko'rinadi, lekin doim disabled**, chip `Not available`, tavsif `SMS is not part of this product — these alerts are delivered by email instead` |
| 11.21 `New alert rule` · DELIVERY | `SMS` checkbox **disabled**, tooltip `SMS is not available` |
| Frontend kodi | `channels` massiviga `SMS` **hech qachon qo'shilmaydi** (zod sxemasida `'IN_APP' \| 'EMAIL' \| 'WEBHOOK'`) |
| `CHANNEL_NOT_AVAILABLE` xatosi | `SMS is not available — this rule will be delivered by email.` |
| E2E test 14 | `SMS` kanali tanlanmasligini tekshiradi |

**Nega qator butunlay olib tashlanmaydi:** dizaynda u bor va admin «SMS qani?» deb
so'ramasligi uchun sabab ko'rsatilishi kerak. Backend enum'ida `SMS` ham qolaveradi
(§14 — kelajakda migratsiyasiz qo'shish uchun).

### 21.6. `Switch role` (account menyusi)
**Dizayn:** rol qatorida `Switch role` havolasi.
**Qaror:** **olib tashlanadi**. Backendda impersonatsiya yo'q va audit izini buzadi
(`AuditLog.actorId` kim ekanini aniqlab bo'lmaydi).

### 21.7. Transfer fayl nomi va ELD identifikatori
**Dizayn:** `ONEB01_Smith_20250910.csv`, `ELD registration #ONEB01`.
**TZ:** §10.2 — fayl nomi Appendix A 4.8.2.2 bo'yicha (`SMITH38018.csv`);
§5.1 — `eldIdentifier` **aynan 4 belgi** (`OBK1`), `ONEB01` **yaroqsiz**.
**Qaror:** frontend fayl nomini **yasamaydi** — `POST /transfers` javobidagi `fileName` va
`carrier.eldIdentifier` ko'rsatiladi. Dizayndagi matn shunchaki mock qiymat.

### 21.8. Billing ekrani
**Dizayn:** `Settings — plan, usage, payment, invoices.jpg` fayl nomi bor, lekin ichida
**Register an ELD device** modali chizilgan.
**TZ:** §1.4 — billing qamrovga kirmaydi.
**Qaror:** billing ekrani **qurilmaydi**, Settings navigatsiyasida yo'q.

### 21.9. Kichik mock artefaktlari (tuzatiladi, muhokamasiz)

| Joy | Muammo | Tuzatish |
|---|---|---|
| `Settings · Company profile` | Ikki toggle kartasi matni vertikal siqilgan | Normal 2 ustunli layout (W-17) |
| Dispatcher/Viewer `Driver profile` | Bo'sh `…` tugmasi | Menyu bo'sh bo'lsa tugma render qilinmaydi |
| Dispatcher/Viewer `My profile` | Subtitle'da `Sarah Chen · Admin` | Haqiqiy foydalanuvchi va rol |
| `Filters` drawer | `ELD DEVICE` da `Pacific Track` ikki marta | Ikkinchisi `PT40` |
| Bir nechta ekran | Chap sidebar subtitle `Fleet Manager` | Bu mahsulot subtitle'i — **o'zgarmaydi** (rol emas) |

---

## 22. Qabul qilish mezonlari

Web relizi quyidagilarning **hammasi** bajarilganda qabul qilinadi:

1. **Ekran soni:** ADMIN 26 · FLEET_MANAGER 21 · DISPATCHER 14 · VIEWER 16 — har biri
   `web/roles and screens/` dagi mos rasmga tuzilishi bo'yicha mos
2. **Matnlar:** barcha sarlavha, ustun nomi, tugma yozuvi, badge va bo'sh holat matni
   dizayndagidek (21-bo'limdagi ataylab o'zgartirilganlardan tashqari)
3. **RBAC:** 12.1 va 12.2 jadvallari testlar bilan qoplangan; ruxsat yo'q element DOM da yo'q
4. **HOS grid:** 24 ustun, 4 qator, 15-daqiqalik tiklar, PC/YM punktir, buzilish belgisi,
   TOTAL ustuni, hover tooltip, `sr-only` jadval
5. **Vaqt mintaqasi:** HOS ekranlarida `driver.homeTerminalTimezone`, boshqa joyda
   `carrier.timezone`; DST kunlari to'g'ri
6. **Birliklar:** hamma joyda imperial, frontend konvertatsiya qilmaydi
7. **eRODS:** TEST rejimi banneri, 60-belgi cheklovi, `fmcsa.dot.gov` validatsiyasi,
   fayl nomi backenddan
8. **`Certify all`** faqat ADMIN'da; **`Send to inspector`** faqat ADMIN va FM'da
8b. ⭐ **Auth rejimlari:** `production` build'da email/parol formasi **bundle'da ham yo'q**,
    `Forgot password?` va `/reset-password` yo'q; `dev` build'da `Developer sign-in` bloki
    va 4 ta demo akkaunt linki ishlaydi (§6.6, §6.7)
8d. ⭐ **Rol bo'yicha bittadan demo akkaunt** bilan 4 ta rolning ham 12.1-jadvaldagi
    ekranlari ochiladi; drayver akkaunti web'dan (`+ Add driver`) yaratiladi va
    `Email address` majburiy (§6.7, §6.8)
8c. ⭐ **SMS hech qayerda yuborilmaydi:** `channels` massivida `SMS` yo'q, UI da kanal
    disabled, drayver taklifnomalari email orqali
9. **Real-time:** 9 ta mavjud hodisa ishlaydi; qolganlari uchun polling; uzilishda banner
   va tiklanishda refetch
10. **Holatlar:** har bir ekranda loading/empty/error/forbidden ko'rsatilgan (13.2 matnlari)
11. **A11y:** axe 0 critical/serious; klaviatura bilan to'liq ishlaydi; fokus ko'rinadi
12. **Performance:** 16.1 bundle budjeti va 16.2 maqsadlari bajarilgan (Lighthouse hisoboti)
13. **Test:** unit ≥ 80% (`format` va `permissions` 100%), kontrakt testlari yashil,
    **16 ta** E2E ssenariysi yashil
14. **CI:** `web` job yashil, budjet va audit darvozalari o'tgan
15. **Backend gap'lari:** 20.1 dagi 6 ta bloklovchi endpoint bajarilgan yoki ular bog'liq
    ekranlar relizdan chiqarilgani hujjatlashtirilgan

---

## 23. Ochiq savollar

| # | Savol | Kimga | Ta'siri |
|---|---|---|---|
| 1 | API prefiksi `/api` yoki `/api/v1`? | Backend | Faqat env, lekin kelishilishi kerak |
| 2 | Xarita tile provayderi (MapTiler / Mapbox / o'z instansiya)? | Buyurtmachi | Litsenziya va narx; MapLibre ikkalasi bilan ishlaydi |
| 3 | `Vehicle groups` modeli kerakmi? | Buyurtmachi | Live Fleet va hisobot filtrlari |
| 4 | Terminal scoping — filtr yoki xavfsizlik chegarasi? | Buyurtmachi | 20.4 (2) |
| 5 | Dark mode kerakmi? | Buyurtmachi | v1 da **yo'q** deb rejalashtirilgan |
| 6 | Ko'p tillilik (ru/uz) kerakmi? | Buyurtmachi | Hozir barcha matn ingliz; i18n karkasi qo'yiladi, tarjima yo'q |
| 7 | Web uchun push (browser notifications) kerakmi? | Buyurtmachi | Hozircha faqat in-app |
| 8 | ⭐ Google hisoblari **korporativ domen** bilan cheklansinmi (`hd` claim)? | Buyurtmachi | Hozir: taklif qilingan istalgan Gmail |
| 9 | ⭐ Admin Gmail'ini yo'qotganda zaxira kirish yo'li (`admin:create` CLI skripti) | Backend | Ularsiz panel butunlay yopilib qolishi mumkin |
| 10 | ⭐ Drayver taklifnomasi email orqali ketadi — `Driver.email` majburiy bo'lsinmi? | Backend | Hozir `email String?` (ixtiyoriy) |

---

## 24. Hujjat tarixi

| Versiya | Sana | O'zgarish |
|---|---|---|
| **1.3** | **2026-09-13** | **Q-4 qarori:** 2FA/TOTP butunlay olib tashlandi — W-00b, `/sign-in/2fa`, W-26 2FA kartasi, W-18 `Reset two-factor` va 2FA filtri, 11.18 `Require two-factor authentication`, `TWO_FACTOR_*` kodlari, §6.2 qoida 4, E2E ssenariy 4; B-26, B-28, B-51 (2FA qismi), B-52, B-53 bekor qilindi (WD-067) |
| 1.0 | 2026-09-12 | Birinchi to'liq versiya. 108 ta dizayn ekrani, amaldagi backend kodi va `backend/tz.md` v3.1 asosida yozildi |
| **1.2** | **2026-09-12** | **Q-3 qarori:** auth ikki rejimga bo'lindi — `dev` (email+parol, seed akkauntlar, 2FA majburiy emas) va `production` (faqat Google). Har bir rol uchun **bittadan kanonik demo akkaunt** belgilandi (§6.7). **Drayver akkauntlari web'dan yaratiladi**, Gmail — kirish identifikatori, prod'da tasdiqlanadi (§6.8). Yangi backend talablari B-29…B-33; E2E 16 ta |
| 1.1 | 2026-09-12 | **Buyurtmachi qarorlari Q-1 va Q-2 kiritildi:** (a) web panelga kirish **faqat Google (Gmail)** — email/parol formasi, `Forgot password?`, `/reset-password`, `My profile` dagi parol gridi va Users menyusidagi `Reset password` olib tashlandi; (b) **SMS umuman ishlatilmaydi** — kanal doim disabled, drayver taklifnomalari email orqali. Yangi backend talablari B-25…B-28, yangi E2E ssenariylari 1, 2 va 14, yangi ochiq savollar 8–10 |
