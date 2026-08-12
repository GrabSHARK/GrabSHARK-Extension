# Lessons — Eklenti Dersleri

> **Kapsam:** Sadece eklentiye özgü yüksek riskli tuzaklar. Ana uygulamanın
> dersleri kardeş repodadır (`../GrabSHARK/tasks/lessons.md`, L1–L52) ve
> burada tekrarlanmaz. "Sistem nasıl çalışır" bilgisi `.txt` referans
> dosyalarına ait.
>
> **Numaralandırma:** `EXT-n`. Ana repodaki L-serisiyle karışmaması için ayrı
> namespace. **Yeni ders eklerken EXT-7'den devam et.**
>
> **Provenance notu (2026-08-07):** Bu dosya açılırken EXT-1…EXT-6, yaşanmış
> olaylardan değil, o gün yapılan kod doğrulamasından çıkarıldı — her dersin
> altında neyin nasıl doğrulandığı yazıyor. Yaşanmış bir olaydan ders çıkarsa
> normal şekilde eklenir.

## EXT-1 — Content script'ten backend'e doğrudan istek yok

Content script ziyaret edilen sayfanın origin'inde çalışır; oradan
GrabSHARK API'sine atılan istek CORS preflight'ına ve cookie kısıtlarına
takılır. Bütün ağ trafiği `MessageRouter` üzerinden background'a gider,
`LinksManager` proxy'ler.

*Doğrulama (2026-08-07):* `src/pages/ContentScript/` altında tek bir
`fetch(`/`axios` çağrısı yok; API sarmalayıcıları yalnızca
`src/@/lib/actions/*` içinde. Ana repodaki Lesson 48'in (bookmarklet
cross-origin fetch) eklenti tarafındaki karşılığı.

## EXT-2 — Sayfaya basılan her UI Shadow DOM içinde

Ziyaret edilen sitenin CSS'i eklenti arayüzünü bozmasın, eklentinin CSS'i
de siteyi bozmasın diye gömülü UI'ların hepsi kendi shadow root'unda
yaşar. Yeni bir gömülü panel eklerken host element + `attachShadow`
kalıbı kopyalanır; doğrudan `document.body`'ye mount edilmez.

*Doğrulama (2026-08-07):* 6 ayrı yerde `attachShadow({ mode: 'open' })` —
`EmbeddedMenuManager`, `NotePanel`, `HighlightToolbox`, `ToastManager`,
`CaptureActionBar` ve `embeddedUI`.

## EXT-3 — Tarayıcı API'si `getBrowser()` üzerinden çağrılır

`src/@/lib/utils.ts`:

```ts
export function getBrowser() {
  return typeof browser !== 'undefined' ? browser : chrome;
}
```

Firefox `browser.*`'ı promise ile, `chrome.*`'ı callback ile sunar.
Doğrudan `await chrome.storage.local.get(...)` yazmak Chromium'da çalışır,
Firefox'ta sessizce beklenmedik sonuç verebilir — hata fırlatmaz, bu yüzden
fark edilmesi zordur. Yeni kod `getBrowser()` ve `getStorageItem()`
helper'larını kullanır.

**Dikkat:** `webextension-polyfill` paketi bağımlılıklarda var ama **yalnızca
`src/@/lib/screenshot.ts`'te** import edilmiş — global bir shim DEĞİL. "Nasıl
olsa polyfill hallediyor" varsayımıyla çıplak `chrome.*` yazma.

*Doğrulama (2026-08-07):* `getBrowser()` 8 dosyada kullanılıyor; buna karşın
Background manager'larında hâlâ doğrudan `chrome.storage.local` çağrıları var
(`index.ts`, `BootstrapManager`, `UserManager`, `PreferencesManager`,
`ConfigManager`). Kod tabanı şu an karışık — yeni kod karışıklığı büyütmesin.

## EXT-4 — İki manifest sessizce ayrışır

`chromium/manifest.json` (MV3) ve `firefox/manifest.json` (MV2) elle ayrı
tutulur; `build.sh` hedefe göre birini `dist/manifest.json`'a kopyalar.
Aynı alanların sözdizimi iki standartta farklı olduğu için körlemesine
kopyalama çalışmaz ve tek tarafa yapılan değişiklik hiçbir uyarı üretmez.

2026-08-07 itibarıyla mevcut ayrışmalar (bilinçli olup olmadıkları
doğrulanmadı — dokunmadan önce kontrol et):

| Alan | MV3 (chromium) | MV2 (firefox) |
|---|---|---|
| `toggle-smart-capture` komutu | var | **yok** |
| Mac kısayolu (action) | `Command+Shift+Y` | `Command+Shift+K` |
| `scripting`, `downloads` izinleri | var | yok |
| `host_permissions` | ayrı alan | `permissions` içinde |
| CSP | obje (`extension_pages`) | düz string |
| `web_accessible_resources` | obje dizisi + `matches` | düz dosya dizisi |
| Content script `all_frames` | `true` | belirtilmemiş |

## EXT-5 — `npm run smoke` bir tarayıcı testi değildir

`scripts/smoke-check.mjs` yalnızca **dist içeriğinin manifest referanslarıyla
hizalı olduğunu** doğrular: manifest'in işaret ettiği dosyalar dist'te var mı,
kritik bundle'lar (`background.js`, `contentScript.js`, `contentMain.js`,
`embeddedUI.js`, `captureDock.js`, `options.js` …) üretilmiş mi. Tarayıcı
açmaz, tek satır eklenti kodu çalıştırmaz.

Yani **"smoke:firefox geçti" Firefox'ta çalıştığını kanıtlamaz** — sadece
Firefox manifest'inin işaret ettiği dosyaların build edildiğini kanıtlar.
Runtime davranışı (MV2 background script, promise/callback farkı, izin
eksikliği) ancak gerçek profile elle yükleyerek doğrulanır. Raporlarken
ölçümün neyi kapsadığını adıyla söyle.

## EXT-6 — Referans `.txt` dosyaları koddan üretilmiyor, sürüklenir

`.txt` envanterleri elle güncelleniyor; **eklenen** şeyler genelde yazılıyor
ama **kaldırılan** şeyler geride kalıyor.

*Doğrulama (2026-08-07):* `grabshark-extension_tech_stack.txt` envanterinde
**Axios** ve **Sonner** duruyor; ikisi de ne `package.json`'da ne de kodda
var — HTTP native `fetch` ile, toast kendi `ToastManager` +
`src/hooks/use-toast.ts` ile yapılıyor. Bir bağımlılığı çıkarırken aynı işte
`.txt`'den de düşür.

## EXT-7 — Yeni locale: dosya bırakmak yetmez, registry'ye satır ekle

`src/@/lib/i18n.ts` içinde `en` **statik** import edilir (bundle'a girer),
diğer 14 locale elle yazılmış bir lazy-load registry'sinden dinamik import
ile yüklenir. `locales/` klasörüne yeni bir JSON bırakmak o dili
görünür yapmaz — registry'ye kendi satırı eklenmelidir. Aynı şekilde
`normalizeLocale` eşlemesi (`zh` → `zh-CN` vb.) ve
`grabshark-extension_i18n.txt` envanteri de güncellenir.

*Doğrulama (2026-08-07):* `i18n.ts:25-38` — 14 satırlık elle yazılmış
`async () => (await import('../locales/xx.json')).default` haritası;
`locales/` altında 15 JSON dosyası.

## EXT-8 — README'de duran özellik, kodda kapalı olabilir

2026-08-11'de README doğrulaması sırasında çıktı: her iki README de eklentinin
"Context Menus" özelliğini, eklenti README'si ayrıca "Bulk Save — Save all tabs"
maddesini reklam ediyordu. Kodda ise `ContextManager.setupMenuItems()` içindeki
**bütün** `contextMenus.create` çağrıları yorum satırında:

> `// TEMPORARILY DISABLED: Context menu items will be re-enabled after improvements are complete`

`genericOnClick` handler'ı duruyor ama onu tetikleyecek menü öğesi hiç
oluşturulmuyor. "Tüm sekmeleri kaydet" de aynı menüye bağlı olduğu için ölü —
`save-all-tabs`'ı kodun başka hiçbir yeri çağırmıyor.

Üç çıkarım:

1. **Geçici olarak kapatılan bir özellik, dokümanda geçici olarak kapatılmalı.**
   "Sonra geri açarız" yorumu kodda kalır, README'de kalmaz; arada geçen sürede
   README kullanıcıya yalan söyler. Kapatan commit README'ye de dokunmalıydı.
2. **Bir handler'ın varlığı, o yolun erişilebilir olduğunu göstermez.** Grep
   `genericOnClick`'i, `save-all-tabs` case'ini ve `tabs.query` çağrısını
   buluyor — üçü de sağlam duruyor. Ölü olan, onları tetikleyen kayıt adımı.
   Bir özelliğin çalıştığını doğrulamak için implementasyonu değil **giriş
   noktasını** aramak gerekir.
3. **Bir bağlam menüsü, tıklanan şeyi kullanmıyorsa zaten yarım.** Eski kod 7
   bağlam tanımlayıp hepsinde `tab.url`'i kaydediyordu; `info.linkUrl`,
   `info.srcUrl`, `info.selectionText` kod tabanında hiç geçmiyor. Yani menü
   açılsaydı bile bağlantıya sağ tıklamak o bağlantıyı kaydetmeyecekti.

README'ler dürüstleştirildi (maddeler çıkarıldı), `grabshark-extension_apis.txt`
ContextManager girdisi gerçeği yazacak şekilde düzeltildi, yeniden açma planı ana
repo `tasks/todo.md`'de duruyor.

## EXT-9 — `getBrowser()` iki tarayıcı tipini birleştirir; vendor tipi yazamazsın

Context menü'yü yeniden açarken build iki yerde patladı ve ikisi de aynı
kökten geliyordu:

```
Type 'browser.contextMenus.OnClickData' is not assignable to type
'chrome.contextMenus.OnClickData'.
  Types of property 'mediaType' are incompatible.
    Type 'string | undefined' is not assignable to '"audio" | "video" | "image"'
```

`getBrowser()` `browser` ya da `chrome` döndürdüğü için tsc `addListener`'ın
**iki imzasının kesişimini** arıyor. `chrome.contextMenus.OnClickData` yazmak
Firefox imzasını, `browser...` yazmak Chromium'unkini ihlal ediyor — hiçbir
vendor tipi kesişimi karşılamıyor. Aynı sebeple `info.linkText` de derlenmiyor:
Firefox veriyor, Chromium vermiyor.

**Çözüm `as any` DEĞİL.** Buradaki cazibe güçlü çünkü tek satır: `(info as any)`.
Ama o zaman `linkText`'in Chromium'da `undefined` geleceği bilgisi de kaybolur —
tip hatası, taşınabilirlik sorununun ta kendisini gösteriyordu. Doğrusu
**kullandığın alanları yapısal bir arayüzle yazmak**:

```ts
interface ContextClickInfo {
    menuItemId: string | number;
    linkUrl?: string; srcUrl?: string; selectionText?: string;
}
browser.contextMenus.onClicked.addListener((info: unknown, tab?: unknown) => {
    void this.onClicked(info as ContextClickInfo, tab as ContextTab | undefined);
});
```

Listener parametrelerini `unknown` alıp içeride daraltmak işe yarıyor: daha
geniş parametre kabul eden bir fonksiyon, daha darını bekleyen imzaya atanabilir.

Aynı aileden ikinci tuzak: **`contextMenus.removeAll` iki ayrı sözleşme.**
Chromium callback bekler, Firefox promise döner. Promise API'sine callback
vermek sessizce hiçbir şey yapmaz — menü hiç kurulmadan akış orada asılı kalır.
İkisini de kabul edip kısa bir zaman aşımı koymak gerekiyor.

Genel kural: `getBrowser()` üzerinden çağrılan her API'de **veri şeklini kendin
yaz, davranış farkını da elle karşıla.** Ders EXT-3 çağrıların nereden
yapılacağını söylüyordu; bu ders çağrının tipini kimin yazacağını söylüyor.
