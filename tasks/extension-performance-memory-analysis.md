# Extension Performans ve Memory Analiz Raporu

## 1. Genel Ozet

Kod tabani son turlarda belirgin bicimde toparlanmis. Ozellikle lazy loading, shared polling, content cleanup registry ve smoke harness dogru yone gidiyor. Bundle boyutlari su an blocker degil: popup `5.92 kB`, content script `3.18 kB`, embedded UI `8.47 kB`, background `34.37 kB` raw. Sorunlar artik bundle sisinliginden cok uzun omurlu content runtime davranisi, Smart Capture CPU maliyeti ve gereksiz veri/memory kopyalari tarafinda.

En kritik 5 problem:

- Content bootstrap tarafinda reinjection sonrasi duplicate listener riski var. [contentScript.tsx](../src/pages/ContentScript/contentScript.tsx)
- Chromium manifest tum URL'lerde ve tum frame'lerde inject ediyor; bu mimari olarak en pahali yuzey. [chromium/manifest.json](../chromium/manifest.json)
- Smart Capture aktif modda tam DOM scan + scroll sirasinda tekrar query/reflow calistiriyor. [SelectableUnits.ts](../src/pages/ContentScript/SmartCapture/SelectableUnits.ts)
- Image pipeline gereksiz blob/base64 kopyalari uretiyor ve `ImageBitmap` kapatilmiyor. [imageProcessor.ts](../src/@/lib/imageProcessor.ts)
- Bootstrap ve config akisi popup, embedded ve content tarafinda tekrar tekrar ayni verileri cekiyor. [BootstrapManager.ts](../src/pages/Background/managers/BootstrapManager.ts)

Genel degerlendirme: Extension calisiyor, ama uzun sure acik tab + cok sekme + Smart Capture aktif kullanim altinda CPU ve heap davranisi gereginden pahali. En buyuk risk alani lifecycle standardizasyonunun repo genelinde esit olmamasi.

## 2. Kritik Bulgular

### Content bootstrap reinjection duplicate listener riski

- **Kategori:** Memory / Messaging / Architecture
- **Konum:** `src/pages/ContentScript/contentScript.tsx`, `src/pages/Background/index.ts`, `src/pages/Background/managers/ConfigManager.ts`
- **Risk Seviyesi:** Kritik
- **Sorun:** `contentScript.tsx` icinde `chrome.runtime.onMessage.addListener` ve `chrome.storage.onChanged.addListener` kuruluyor ama teardown yok. Ayni sekmeye tekrar `contentScript.js` inject edilirse ayni listener'larin yeni kopyalari eklenebilir.
- **Neden Problem:** Background tarafi hem `ensureContentScriptInjected()` hem de config bootstrap fallback icinde tekrar inject etmeyi deniyor. Bu, ayni frame'de duplicate callback zincirleri uretir.
- **Gercek Etki:** Her config update veya runtime message daha fazla handler tarafindan islenir; CPU ve memory yavas yavas artar, bazi akislar iki kez tetiklenebilir.
- **Nasil Duzeltilir:** `contentScript.tsx` icin global singleton guard ekle. `window.__grabsharkContentScriptInitialized` benzeri bir flag ile listener setup yalnizca bir kez calissin.
- **Ornek Refactor Yaklasimi:** Bootstrap listener'larini `installContentBootstrapOnce()` icine tasi; `dispose` fonksiyonu uret; reinjection durumunda once eski instance'i kapat.

### Tum URL + all_frames injection mimari maliyeti

- **Kategori:** CPU / Startup / Architecture
- **Konum:** `chromium/manifest.json`, `firefox/manifest.json`
- **Risk Seviyesi:** Yuksek
- **Sorun:** Chromium tarafinda content script `<all_urls>` + `all_frames: true` ile yukleniyor. Firefox tarafinda da `<all_urls>` global yuk var.
- **Neden Problem:** Her frame icin bootstrap calisiyor; cogu frame'de is yapilmasa bile script parse, marker yaratma, config check ve listener setup maliyeti olusuyor.
- **Gercek Etki:** Cok iframe'li sitelerde startup maliyeti, memory footprint ve background message sayisi gereksiz artar.
- **Nasil Duzeltilir:** Selective injection mimarisine gec. En azindan top frame default olsun; iframe destegi yalniz gereken feature'lara kalsin.
- **Ornek Refactor Yaklasimi:** `manifest` kapsamini daraltmak yerine once top-frame bootstrap + explicit iframe opt-in katmani kur.

### Smart Capture tam DOM scan ve reflow hot path'i

- **Kategori:** CPU / DOM / Rendering
- **Konum:** `src/pages/ContentScript/SmartCapture/SelectableUnits.ts`, `SelectionManager.ts`, `SmartCaptureMode.ts`, `CaptureOverlay.ts`
- **Risk Seviyesi:** Yuksek
- **Sorun:** Smart Capture acilinca cok sayida selector ile tam DOM taramasi yapiliyor; mousemove/scroll sirasinda overlay ve selection state surekli yeniden hesaplaniyor.
- **Neden Problem:** `querySelectorAll` taramalari, `elementsFromPoint`, `getBoundingClientRect`, scroll sirasinda viewport query'leri ve overlay refresh birlesince buyuk sayfalarda pahali hale geliyor.
- **Gercek Etki:** Scroll jank, mousemove lag, ozellikle uzun article / dashboard / infinite scroll sayfalarinda CPU artisi.
- **Nasil Duzeltilir:** Incremental scan, viewport-bounded scan ve cached viewport metrics kullan. Scroll'da tam refresh yerine dirty-region yaklasimi uygula.
- **Ornek Refactor Yaklasimi:** `SelectableUnits.scan()` sonucunu container mutation hash'i ile cache'le; `SelectionManager` icindeki viewport hesaplarini scroll frame basina bir kez yap; `CaptureOverlay` scroll update'ini `requestAnimationFrame` ile throttle et.

### Image pipeline gereksiz kopya uretiyor ve `ImageBitmap` kapatilmiyor

- **Kategori:** Memory / CPU / Rendering
- **Konum:** `src/@/lib/imageProcessor.ts`, `src/pages/Background/managers/MediaManager.ts`
- **Risk Seviyesi:** Yuksek
- **Sorun:** Flow su an `fetch -> blob -> FileReader base64 -> fetch(base64) -> blob -> createImageBitmap -> canvas -> blob/dataURL` seklinde ilerliyor. `imageBitmap.close()` da cagrilmiyor.
- **Neden Problem:** Buyuk gorsellerde ayni binary verinin birkac kopyasi ayni anda heap'te ve gecici grafik memory'de tutuluyor.
- **Gercek Etki:** Embedded/save akisinda transient heap spike, dusuk RAM'li makinelerde GC baskisi, GPU/bitmap kaynak sizintisi.
- **Nasil Duzeltilir:** Background'dan base64 yerine dogrudan `ArrayBuffer` ya da blob-benzeri transferable veri tasi. `createImageBitmap` sonrasi `finally { imageBitmap.close(); }` ekle.
- **Ornek Refactor Yaklasimi:** `FETCH_IMAGE_BLOB` yanitini `base64Data` yerine `Uint8Array` ya da `ArrayBuffer` olarak dondur; content tarafinda ikinci `fetch(base64)` asamasini kaldir.

### Bootstrap verisi her mount'ta tekrar yukleniyor

- **Kategori:** Startup / Messaging / Network
- **Konum:** `src/pages/Background/managers/BootstrapManager.ts`, `src/pages/Popup/App.tsx`, `src/pages/ContentScript/EmbeddedApp.tsx`, `src/pages/ContentScript/contentMain.tsx`
- **Risk Seviyesi:** Yuksek
- **Sorun:** Popup acilisinda, embedded acilisinda ve content init sirasinda config/domain/user/collections/tags/prefs tekrar tekrar cozuluyor.
- **Neden Problem:** Ayni tarayici oturumunda kisa araliklarla ayni bootstrap verisi icin ekstra runtime message + network + storage okumasi olusuyor.
- **Gercek Etki:** Acilis gecikmesi, service worker wake-up sayisinda artis, gereksiz API trafigi.
- **Nasil Duzeltilir:** Background tarafinda kisa TTL'li bootstrap cache koy. `baseUrl+hostname` bazli 5-15 saniyelik cache yeterli.
- **Ornek Refactor Yaklasimi:** `BootstrapManager.getBootstrapState()` onune `Map<string, { expiresAt, data }>` koy; preferences/config degisince invalid et.

### BadgeManager aktif sekme ve navigation'da fazla is yapiyor

- **Kategori:** CPU / Network / Service Worker
- **Konum:** `src/pages/Background/managers/BadgeManager.ts`
- **Risk Seviyesi:** Orta
- **Sorun:** Her tab activation ve page complete event'inde preferences, config ve link existence cozuluyor.
- **Neden Problem:** TTL olsa da sadece `30s`; aktif sekme dolasiminda service worker surekli uyaniyor ve API'ye gidebiliyor.
- **Gercek Etki:** Gereksiz wake-up, network chatter, cok sekmeli kullanimda hissedilir background yuku.
- **Nasil Duzeltilir:** Tab/url bazli debounce + tab state cache ekle. `status=complete` disinda ignore zaten var, ama active-tab event icin son kontrol zamani tutulmali.
- **Ornek Refactor Yaklasimi:** `tabId+url` key'li recent badge cache tut; ayni kombinasyonu 5-10 saniye icinde yeniden sorgulama.

### Async iptal/cancel standardi yok

- **Kategori:** Memory / Async / Rendering
- **Konum:** `src/@/components/SaveLinkCard.tsx`, `src/pages/ContentScript/EmbeddedApp.tsx`, `src/@/components/Modal.tsx`
- **Risk Seviyesi:** Orta
- **Sorun:** Repo genelinde `AbortController` yok. Bircok async islem ve UI transition timer'i unmount sonrasi yasamaya devam edebiliyor.
- **Neden Problem:** Bu durum dogrudan sonsuz leak uretmeyebilir ama stale closure, gereksiz state update, gereksiz image processing ve race condition uretir.
- **Gercek Etki:** Popup ve embedded hizli ac-kapatta anlamsiz state set attempt'leri, gereksiz CPU harcamasi, bazen yanlis UI state.
- **Nasil Duzeltilir:** Ortak `useAbortableAsync` / `DisposableBag` / `useManagedTimeout` standardi getir.
- **Ornek Refactor Yaklasimi:** Ozellikle `useSaveLinkInit` icindeki image processing ve embedded transition timer'larini disposable helper'a tasi.

### Cache katmani bounded ama halen pahali

- **Kategori:** Memory / Cache / Storage
- **Konum:** `src/@/lib/authorizedImageUrl.ts`, `src/@/lib/thumbnailCache.ts`
- **Risk Seviyesi:** Orta
- **Sorun:** Authorized image cache object URL tutuyor; thumbnail cache ise her read'de blob'u tekrar base64 string'e ceviriyor.
- **Neden Problem:** Bounded olmasina ragmen memory formu pahali. Ozellikle base64, blob'dan belirgin sekilde daha maliyetli.
- **Gercek Etki:** Sik thumbnail acilislarinda kisa sureli heap buyumesi ve GC yuku.
- **Nasil Duzeltilir:** UI katmaninda mumkun oldugunca blob/object URL ile calis; base64 uretimini son care yap.
- **Ornek Refactor Yaklasimi:** `thumbnailCache.getThumbnail()` data URL dondurmek yerine blob/object URL dondursun; consumer unmount'ta revoke etsin.

### Global toast store gereksiz subscription churn uretiyor

- **Kategori:** CPU / Rendering / State
- **Konum:** `src/hooks/use-toast.ts`
- **Risk Seviyesi:** Dusuk
- **Sorun:** `useToast()` effect'i `[state]` bagimliligi ile her state degisiminde listener re-register ediyor.
- **Neden Problem:** Leak degil ama gereksiz subscription churn. `toastTimeouts` de timeout sonuna kadar tutuluyor.
- **Gercek Etki:** Kucuk ama surekli state hareketlerinde gereksiz work.
- **Nasil Duzeltilir:** Effect dependency'yi `[]` yap. Timeout map'ini manual dismiss'te de temizle.
- **Ornek Refactor Yaklasimi:** `useEffect(() => { listeners.push(setState); return cleanup; }, [])`

## 3. Muhtemel Memory Leak Noktalari

### Kesin leak

- `src/@/lib/imageProcessor.ts`: `createImageBitmap()` sonrasi `imageBitmap.close()` yok. Ozellikle cok gorselli kullanimda gercek kaynak sizintisi riski tasiyor.

### Yuksek riskli

- `src/pages/ContentScript/contentScript.tsx`: reinjection ile duplicate `runtime.onMessage` / `storage.onChanged` listener
- `src/pages/ContentScript/EmbeddedApp.tsx`: global `QueryClient` tab omru boyunca state tutuyor; leak degil ama uzun omurlu retention
- `src/@/lib/authorizedImageUrl.ts`: object URL cache sadece `beforeunload` veya eviction ile temizleniyor
- `src/@/components/SaveLinkCard.tsx`: unmount sonrasi da surebilen async image processing

### Izlenmeli

- `src/@/lib/i18n.ts`: module-level `storage.onChanged` listener cleanup'siz
- `src/pages/ContentScript/HighlightToolbox.ts`, `NotePanel.ts`, `SmartCapture/CaptureActionBar.ts`: untracked close/hide timer'lari
- `src/@/lib/thumbnailCache.ts`: repeated `FileReader.readAsDataURL` heap baskisi olusturur

Not: `runtime.connect` / `tabs.connect` kullanilmiyor. Uzun omurlu port leak tespit edilmedi.

## 4. Performans Iyilestirme Firsatlari

- **Startup:** Content bootstrap'ta `CHECK_CONFIG`, `GET_DOMAIN_PREFERENCE`, `getEffectivePreferences`, `getPreferences` zincirini tek bootstrap payload'a indir.
- **Bundle:** Bundle boyutu iyi. Asil firsat parse/load degil runtime work.
- **DOM islemleri:** Smart Capture scan'ini viewport/container scoped hale getir; scroll frame'de DOM query tekrarlarini azalt.
- **Messaging:** Background bootstrap cache ve content-side request coalescing ekle.
- **Storage:** `getPreferences/getConfig` sik kullanilan path'lerde hot cache ile servis edilebilir.
- **Async yapi:** `AbortController` standardi getir; ozellikle image/network ve transition timer path'lerinde.
- **Cache mimarisi:** Base64 yerine blob/object URL-first cache kullan.
- **Content script optimizasyonu:** Top-frame first, iframe opt-in, duplicate injection guard.
- **Background/service worker:** Badge ve preferences broadcast path'lerini debounce et; full-tab query'leri azalt.

## 5. Mimari Iyilestirme Onerileri

- Tek bir `DisposableBag` / `ResourceScope` standardi olustur.
- Her UI modulu `mount(): teardown` modeline gecsin.
- Async isler icin `withAbort(signal)` standardi getir.
- Content bootstrap icin singleton installer pattern'i kullan.
- Smart Capture icin scan engine ve overlay engine ayristr; scan sonucu immutable snapshot olsun.
- Background tarafinda kisa TTL'li `ConfigCache`, `BootstrapCache`, `BadgeCache` standardize edilsin.
- Resource management guardrail:
  - listener ekleyen her modul ayni dosyada teardown tanimlasin
  - timer ekleyen her modul timer handle'ini instance state'te tutsun
  - object URL ureten her modul owner/revoke stratejisi tasisin

## 6. Onceliklendirilmis Aksiyon Plani

- **P0:** `contentScript.tsx` duplicate listener/reinjection problemini kapat
- **P0:** `processOgImage()` icinde base64 roundtrip'i kaldir ve `imageBitmap.close()` ekle
- **P0:** Smart Capture scan/reflow path'inde tam DOM tarama ve scroll query maliyetini dusur
- **P1:** `BOOTSTRAP_EXTENSION_STATE` icin background TTL cache ekle
- **P1:** `BadgeManager` icin tab/url bazli debounce ve daha agresif cache ekle
- **P1:** Async/timer cancellation helper'ini repo standardi yap
- **P1:** Object URL / thumbnail cache'te blob-first stratejiye gec
- **P2:** `i18n.ts` ve `use-toast.ts` global listener/store katmanlarini sadeleştir
- **P2:** `all_frames / iframe` kapsamını mimari milestone olarak daralt

## 7. Hizli Kazanclar

- `contentScript.tsx` icine global install guard eklemek
- `imageBitmap.close()` eklemek
- `use-toast` effect dependency'sini `[]` yapmak
- `CaptureOverlay` scroll update'ini `requestAnimationFrame` ile throttle etmek
- `SelectionManager` icindeki `querySelectorAll('[class*=\"overflow-auto\"]')` cagrilarini cachelemek
- `useSaveLinkInit` ve benzeri effect'lere `active` flag veya abort destegi eklemek

## 8. Gozden Gecirme Checklist'i

- Listener cleanup ayni modulde mi?
- Observer disconnect garanti mi?
- Timeout/interval handle'lari instance state'te mi tutuluyor?
- Async fetch'lerde cancel/ignore strategy var mi?
- Object URL uretiliyorsa revoke noktasi tanimli mi?
- Cache icin TTL veya eviction var mi?
- Tab/frame navigation sonrasi teardown garanti mi?
- React unmount sonrasi state update riski kapatilmis mi?
- Background event'leri network/storage calistirmadan once debounce/cache kontrolu yapiyor mu?
- DOM scan'leri event hot path'ine girmis mi?

## A. En riskli 10 satir / blok / pattern

1. `src/pages/ContentScript/contentScript.tsx`: `setupConfigRefreshListeners()` cleanup'siz listener setup
2. `chromium/manifest.json`: `<all_urls>` + `all_frames: true`
3. `src/@/lib/imageProcessor.ts`: blob -> base64 -> blob -> bitmap -> canvas zinciri
4. `src/@/lib/imageProcessor.ts`: `createImageBitmap` sonrasi `close()` yok
5. `src/pages/ContentScript/SmartCapture/SelectableUnits.ts`: tam DOM scan
6. `src/pages/ContentScript/SmartCapture/SelectableUnits.ts`: `elementsFromPoint` hot path
7. `src/pages/ContentScript/SmartCapture/SelectionManager.ts`: scroll sirasinda tekrar DOM query
8. `src/pages/Background/managers/BootstrapManager.ts`: her bootstrap'ta user + collections + tags + prefs + domain fetch
9. `src/pages/Background/managers/BadgeManager.ts`: tab event'lerinde config/preferences/network zinciri
10. `src/@/components/SaveLinkCard.tsx`: cleanup/cancellation'siz async init ve image preprocessing

## B. Olcumleme Onerileri

- Chrome DevTools `Memory` panel:
  - Heap snapshot before/after embedded ac-kapat 20 kez
  - Allocation instrumentation on timeline, Smart Capture aktif scroll sirasinda
- Chrome DevTools `Performance` panel:
  - Smart Capture acikken 10 sn scroll
  - Highlight hover + selection toolbox ac/kapa
- Chrome DevTools `Performance Insights`:
  - mousemove/scroll handler maliyeti
- `chrome://extensions` service worker inspect:
  - background wake-up pattern'i, message frequency, network count
- Heap diff stratejisi:
  - bos sayfa
  - cok iframe'li sayfa
  - uzun article/infinite scroll sayfasi
- Extension ozel gozlem:
  - contentScript bootstrap count
  - active listener count
  - active observer count
  - active shared poll task count
  - object URL cache size
- Network panel:
  - popup acilisinda bootstrap request sayisi
  - badge refresh sirasinda `checkLinkExists` frekansi

## C. Refactor Stratejisi

1. Content bootstrap singleton + reinjection safety
2. Image pipeline sadelestirme ve bitmap/object URL kaynak yonetimi
3. Smart Capture scan/overlay ayristrmasi ve hot-path throttling
4. Background bootstrap/config/badge kisa TTL cache
5. Async cancellation standardi ve managed timer helper
6. Cache katmanini blob-first ve owner-based cleanup modeline tasima
7. Son asamada `all_frames / iframe` kapsam daraltma

Net sonuc: En buyuk muhendislik borcu artik UI kodu cok buyuk degil, runtime yuzeyi cok genis ve cok uzun omurlu. P0'lar kapatilmadan bu extension uzun kullanimda gereginden pahali kalir.
