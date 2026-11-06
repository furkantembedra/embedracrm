# Graph Report - embedracrm  (2026-11-06)

## Corpus Check
- 164 files · ~53,364 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .css 2, .md, 1)

## Summary
- 805 nodes · 2278 edges · 42 communities (16 shown, 26 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Bayi Başvuru Akışı
- Cihaz ve Lisans
- Satış Hattı ve Gelir
- Müşteri Yönetimi
- Destek Talepleri
- Detay ve Yeni Sayfaları
- Raporlar ve Bayi Metrikleri
- Genel Bakış Grafikleri
- Bağımlılıklar ve Araçlar
- README ve Tasarım Mockupları
- Bayi Hareketleri ve Cihaz API
- Liste Sayfaları
- TypeScript Ayarları
- shadcn Ayarları
- Yerleşim ve Menü
- Giriş Sayfası
- Varsayılan İkonlar
- Next.js Ajan Kuralları
- Next ve Vercel Logoları

## God Nodes (most connected - your core abstractions)
1. `react` - 41 edges
2. `Chip()` - 39 edges
3. `PageHeader()` - 37 edges
4. `next` - 31 edges
5. `useBugun()` - 29 edges
6. `lucide-react` - 28 edges
7. `MusteriDetay()` - 25 edges
8. `BayiGorunumu()` - 22 edges
9. `BayiDetay()` - 20 edges
10. `getMusteriler()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `İçerik takvimi` --semantically_similar_to--> `Takvim`  [INFERRED] [semantically similar]
  tasarimlar/project/Marketing.dc.html → README.md
- `BasvuruIcerik()` --calls--> `BayiGorunumu()`  [EXTRACTED]
  app/bayiler/[id]/page.tsx → components/bayiler/bayi-gorunumu.tsx
- `BayilerPage()` --calls--> `BayiGorunumu()`  [EXTRACTED]
  app/bayiler/page.tsx → components/bayiler/bayi-gorunumu.tsx
- `RaporlarPage()` --calls--> `getAktifBayiler()`  [EXTRACTED]
  app/bayiler/raporlama/page.tsx → components/bayiler/queries.ts
- `RaporlarPage()` --calls--> `getCihazlar()`  [EXTRACTED]
  app/bayiler/raporlama/page.tsx → components/cihaz-lisans/queries.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sipariş karşılama akışı** — tasarimlar_project_orders_dc_order, tasarimlar_project_orders_dc_fulfillment_flow, tasarimlar_project_orders_dc_serial_number, tasarimlar_project_orders_dc_shipment_invoice, tasarimlar_project_orders_dc_onesuite_license [EXTRACTED 1.00]
- **Hedef liste → kampanya → lead** — tasarimlar_project_marketing_dc_target_lists, tasarimlar_project_marketing_dc_campaign, tasarimlar_project_marketing_dc_lead [INFERRED 0.85]
- **Default create-next-app starter public assets** — public_file_file_icon, public_globe_globe_icon, public_next_next_logo, public_vercel_vercel_logo, public_window_window_icon [INFERRED 0.95]

## Communities (42 total, 26 thin omitted)

### Community 0 - "Bayi Başvuru Akışı"
Cohesion: 0.06
Nodes (82): asamaIlerlet(), BasvuruFormDurumu, basvuruKaydet(), basvuruSil(), bugunIso(), GorusmeFormDurumu, gorusmeKaydet(), IlerletmeSonucu (+74 more)

### Community 1 - "Cihaz ve Lisans"
Cohesion: 0.06
Nodes (73): CihazFormDurumu, cihazKaydet(), LisansFormDurumu, lisansTanimla(), metinAl(), PLANLAR, SURELER, yenile() (+65 more)

### Community 2 - "Satış Hattı ve Gelir"
Cohesion: 0.07
Nodes (60): SatisHattiPage(), musteriBulAdla(), musteriEkle(), UlkeGeliri, UlkeGelirleri(), AsamaSonucu, firsatAsamasiGuncelle(), FirsatFormDurumu (+52 more)

### Community 3 - "Müşteri Yönetimi"
Cohesion: 0.06
Nodes (53): MusterilerPage(), YeniMusteriPage(), birincilYap(), FormDurumu, musteriKaydet(), musteriSayfalariniYenile(), notEkle(), NotFormDurumu (+45 more)

### Community 4 - "Destek Talepleri"
Cohesion: 0.09
Nodes (48): aracKapsamiIstegi(), dosyaAdi(), metinAl(), NotFormDurumu, notKaydet(), TalepFormDurumu, talepKaydet(), yenile() (+40 more)

### Community 5 - "Detay ve Yeni Sayfaları"
Cohesion: 0.08
Nodes (29): YeniBasvuruPage(), CihazIcerik(), CihazPage(), Yukleniyor(), YeniCihazPage(), MusteriIcerik(), MusteriPage(), Yukleniyor() (+21 more)

### Community 6 - "Raporlar ve Bayi Metrikleri"
Cohesion: 0.10
Nodes (33): RaporlarPage(), moqYuzde(), DestekKonulari(), DonemSecici(), HAZIR_RAPORLAR, HazirRapor, KATEGORI_BILGI, raporAltBasligi() (+25 more)

### Community 7 - "Genel Bakış Grafikleri"
Cohesion: 0.07
Nodes (38): GenelBakisPage(), DEMO, eksenUstu(), GelirAyi, GelirGrafigi(), DEMO, LeadKaynaklari(), LeadKaynaklariVerisi (+30 more)

### Community 8 - "Bağımlılıklar ve Araçlar"
Cohesion: 0.06
Nodes (41): eslintConfig, dependencies, class-variance-authority@^0.7.1, cn@^0.5.2, lucide-react@^1.67.0, next@16.4.4, react@19.3.0, react-dom@19.3.0 (+33 more)

### Community 9 - "README ve Tasarım Mockupları"
Cohesion: 0.05
Nodes (42): Ayarlar, Embedra CRM, Firmalar, Genel Bakış, Görevler, Kişiler, Lucide Icons, Next.js (App Router) (+34 more)

### Community 10 - "Bayi Hareketleri ve Cihaz API"
Cohesion: 0.11
Nodes (35): g, GET(), hata(), POST(), Altlik(), Hata(), LisansSatisFormu(), ModelSecimi() (+27 more)

### Community 11 - "Liste Sayfaları"
Cohesion: 0.17
Nodes (23): BasvuruIcerik(), BasvuruPage(), Yukleniyor(), BayilerPage(), CihazLisansPage(), TalepIcerik(), TalepPage(), Yukleniyor() (+15 more)

### Community 12 - "TypeScript Ayarları"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "shadcn Ayarları"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 14 - "Yerleşim ve Menü"
Cohesion: 0.23
Nodes (10): jakarta, metadata, RootLayout(), AktifMenu(), ANA_MENU, Menu(), MenuBolumu(), MenuOgesi (+2 more)

### Community 16 - "Varsayılan İkonlar"
Cohesion: 0.67
Nodes (3): File/document icon (16x16 page with folded corner and text lines), Globe icon (16x16 world/web symbol), Browser window icon (16x16 window with title-bar dots)

## Knowledge Gaps
- **26 isolated node(s):** `node_modules/next/dist/docs guides`, `Genel Bakış`, `Kişiler`, `Firmalar`, `Görevler` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 228 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Cihaz ve Lisans` to `Bayi Başvuru Akışı`, `Satış Hattı ve Gelir`, `Müşteri Yönetimi`, `Destek Talepleri`, `Detay ve Yeni Sayfaları`, `Genel Bakış Grafikleri`, `Bağımlılıklar ve Araçlar`, `Bayi Hareketleri ve Cihaz API`, `Liste Sayfaları`, `Yerleşim ve Menü`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useBugun()` (e.g. with `abone()` and `gunBasi()`) actually correct?**
  _`useBugun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `node_modules/next/dist/docs guides`, `Genel Bakış`, `Kişiler` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bayi Başvuru Akışı` be split into smaller, more focused modules?**
  _Cohesion score 0.0597979797979798 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Satış Hattı ve Gelir` to `Bayi Başvuru Akışı`, `Cihaz ve Lisans`, `Müşteri Yönetimi`, `Destek Talepleri`, `Detay ve Yeni Sayfaları`, `Raporlar ve Bayi Metrikleri`, `Bağımlılıklar ve Araçlar`, `Bayi Hareketleri ve Cihaz API`, `Liste Sayfaları`, `Yerleşim ve Menü`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Should `Cihaz ve Lisans` be split into smaller, more focused modules?**
  _Cohesion score 0.06382978723404255 - nodes in this community are weakly interconnected._
- **Why does `PageHeader()` connect `Detay ve Yeni Sayfaları` to `Bayi Başvuru Akışı`, `Cihaz ve Lisans`, `Satış Hattı ve Gelir`, `Müşteri Yönetimi`, `Destek Talepleri`, `Raporlar ve Bayi Metrikleri`, `Genel Bakış Grafikleri`, `Liste Sayfaları`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._