# AGENTS.md — GrabSHARK Extension Çalışma Talimatları

> **Ana talimat dosyası budur.** `CLAUDE.md` sadece `@AGENTS.md` import'u
> içerir. Bu repo, ana uygulama repo'su (`GrabSHARK`) ile birlikte çalışır;
> ortak kuralların tam hali oradaki `AGENTS.md`'dedir — bu dosya onu
> tekrarlamaz, eklentiye özgü olanı yazar. (Oluşturuldu: 2026-08-07)

## Oturum Başlangıcı

1. Bu dosya.
2. `tasks/lessons.md` — eklentiye özgü tuzaklar (EXT serisi).
3. Dokunulacak alanın `.txt` referansı (aşağıdaki tablo).
4. Kardeş repo çalışılabilir durumdaysa `../GrabSHARK/AGENTS.md` (ortak
   kuralların tam hali), `../GrabSHARK/tasks/lessons.md` (L serisi) ve
   `../GrabSHARK/tasks/active-context.md` (güncel durum).

## Mimari — üç bağlam, tek mesaj yolu

Eklenti üç ayrı JS bağlamında çalışır ve bunlar **doğrudan** birbirini
çağıramaz:

| Bağlam | Yer | Rolü |
|---|---|---|
| Background (service worker) | `src/pages/Background/` | Auth, API proxy, badge, context menu, bookmarks |
| Content script | `src/pages/ContentScript/` | Sayfaya enjekte olan UI: highlight, not, Smart Capture |
| Options / popup | `src/pages/Options/`, `src/@/components/` | React arayüzü |

Kurallar:

- **Bağlamlar arası her iletişim `MessageRouter` üzerinden** gider
  (`SAVE_LINK_FROM_EXTENSION`, `CHECK_LINK_EXISTS`, `CAPTURE_VISIBLE_TAB`,
  `SAVE_HIGHLIGHT`, `SMART_CAPTURE`). Yeni bir mesaj tipi eklerken hem
  gönderen tarafı hem router'ı hem de `grabshark-extension_apis.txt`'yi güncelle.
- **Content script'ten backend'e doğrudan `fetch`/`axios` YOK.** CORS'a
  takılır; istek `LinksManager` üzerinden background'a proxy'lenir. (Ana
  repodaki Lesson 48'in eklenti tarafındaki karşılığı.)
- **Sayfaya basılan her UI Shadow DOM içinde** (`embeddedUI.ts`). Ziyaret
  edilen sitenin CSS/JS'i eklenti arayüzünü etkilememeli, tersi de geçerli.
- API sarmalayıcıları `src/@/lib/actions/*` altında toplanır; bileşenler
  endpoint URL'i elle kurmaz.

## İki manifest — MV3 + MV2

`chromium/manifest.json` (Manifest V3, service worker) ve
`firefox/manifest.json` (Manifest V2, background scripts) **ayrı ayrı**
tutulur. `build.sh` hangi hedefe build ediliyorsa o manifest'i
`dist/manifest.json`'a kopyalar.

- **Manifest'e dokunan her değişiklik İKİ dosyada da yapılır.** İzin,
  komut, `web_accessible_resources` ve CSP alanlarının MV2/MV3 sözdizimi
  farklıdır — körlemesine kopyalama çalışmaz.
- Yeni izin talebi eklemek mağaza incelemesini etkiler; gerçekten gerekli
  değilse ekleme.
- **Tarayıcı API'si `getBrowser()` üzerinden çağrılır** (`src/@/lib/utils.ts`
  — `typeof browser !== 'undefined' ? browser : chrome`). Çıplak `chrome.*`
  Firefox'ta callback API'sine düşer ve sessizce yanlış davranır.
  `webextension-polyfill` global shim DEĞİL — sadece `screenshot.ts`'te
  import edilmiş. Detay: `tasks/lessons.md` EXT-3.
- Mevcut MV2/MV3 ayrışmalarının listesi: `tasks/lessons.md` EXT-4.

## i18n

- Kullanıcıya görünen her metin `useTranslation()` → `t("saveLink.title")`.
- 15 locale, `src/@/locales/*.json`. `en` statik import edilir, diğer 14'ü
  `i18n.ts` içindeki **elle yazılmış lazy-load registry**'sinden gelir —
  klasöre JSON bırakmak yetmez, registry'ye satır eklenir (EXT-7).
- Seçili dil `chrome.storage.local` içinde `grabshark_locale` anahtarında;
  tespit sırası: storage → `navigator.language` → `en`.
- Yeni key: `en.json`'a ekle → 14 locale'e taşı (TR çevir, kalanına EN
  fallback) → `grabshark-extension_i18n.txt`'yi güncelle.

## Güvenlik

- **Bearer token background'da kalır.** Content script'e, sayfaya ya da
  `window`'a token sızdırılmaz; yenileme `AuthManager`'ın işidir.
- Ziyaret edilen sayfadan gelen DOM içeriği güvenilmezdir — seçili metin,
  başlık ve URL sunucuya gönderilmeden önce normalize edilir
  (`normalizers.ts`).
- `<all_urls>` host izniyle çalışıyoruz: sayfa içeriğini gereğinden fazla
  okuma, log'lama veya sunucuya gönderme.
- Commit'lenen hiçbir dosyaya gerçek hostname/port/credential yazılmaz.

## Referans Dokümantasyon — GÜNCEL TUTMA ZORUNLULUĞU

Repo kökündeki `.txt` dosyaları elle güncel tutulur. **İki repoda da aynı
set var ve senkron tutulur** (ana repo + eklenti mirror'ları, iki yönlü):

| Dosya | Kapsam |
|---|---|
| `grabshark-extension_apis.txt` | Mesaj tipleri, background manager'lar, API sarmalayıcıları |
| `grabshark-extension_components.txt` | React bileşenleri |
| `grabshark-extension_pages.txt` | Popup/options/content script giriş noktaları |
| `grabshark-extension_design.txt` | Tema, Shadow DOM stil sistemi |
| `grabshark-extension_tech_stack.txt` | Kütüphane/altyapı envanteri |
| `grabshark-extension_i18n.txt` | i18n sistemi, locale envanteri |

Ayrıca ana uygulamanın `grabshark_*.txt` kopyaları da burada durur; ana
repoda güncellenen bir şey buraya da yansıtılır.

`README.md` senkron kuralı ana repodakiyle aynı ağırlıktadır: özellik
ekleme/çıkarma/değiştirme README'ye de yansır.

## Doğrulama

**Kanıt olmadan "bitti" denmez.**

```bash
npm run lint          # eslint, --max-warnings 0
npm run build         # tsc + 4 ayrı vite build + bundle raporu
npm run smoke         # build + chromium smoke-check
npm run smoke:firefox # build + firefox smoke-check
```

- Paket yöneticisi **npm** (`build.sh` `npm install` çağırıyor).
  `yarn.lock` de repoda duruyor ama tek kaynak `package-lock.json`.
- Manifest'e dokunulduysa iki hedefi de build et — MV2 tarafı sessizce
  bozulabilir.
- **`smoke` bir tarayıcı testi değildir:** yalnızca dist'teki dosyaların
  manifest referanslarıyla hizalı olduğunu doğrular; eklenti kodunu
  çalıştırmaz. Runtime davranışı için gerçek profile elle yükle. Raporlarken
  ölçümün neyi kapsadığını adıyla söyle (EXT-5, ana repo "Kök Neden Çıtası").

## Git & Commit

- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **Commit mesajlarına Claude/Anthropic atıfı (Co-Authored-By vb.)
  EKLENMEZ.**
- Commit'ler kullanıcı onayı olmadan atılmaz; yarım iş commit'lenmez.
- Aktif branch sadece `main` (2026-07-26 kararı — `dev` PR #7 ile merge
  edilip silindi, yeniden açılmaz).

## Done Kriterleri

Şunlardan biri eksikse iş **tamamlanmamıştır**:

- `npm run lint` / `npm run build` temiz değil ya da hiç çalıştırılmadı.
- Manifest değişikliği tek tarayıcıya yapılmış (MV2 veya MV3 unutulmuş).
- Content script'ten backend'e doğrudan istek eklenmiş (background proxy'si
  atlanmış).
- Sayfaya Shadow DOM dışında DOM basılmış.
- Yeni kullanıcı metni 15 locale'in tamamına eklenmemiş.
- Değişiklik ilgili `.txt` referansına yansıtılmamış (ana repo kopyası dahil).
- Özellik değişimi `README.md`'ye yansıtılmamış.
- Kalıcı bir tuzak ortaya çıktığı halde `tasks/lessons.md`'ye (EXT serisi)
  yazılmamış.
- Çalıştırılmayan bir doğrulama çalıştırılmış gibi raporlanmış — özellikle
  `smoke`'un kapsamadığı runtime davranışı (EXT-5).
