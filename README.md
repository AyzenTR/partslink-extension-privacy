# PartsLink AI Scraper Extension

Bu Chrome eklentisi, partslink24.com üzerinde yapay zeka destekli otomatik araç parçası arama işlemi gerçekleştirir. VIN numarası kullanarak araç bilgilerini alır ve AI (Gemini 2.0 Flash) ile sayfaları analiz ederek otomatik navigasyon yapar.

## Özellikler

- **VIN Tabanlı Arama**: VIN numarası ile araç bilgilerini otomatik olarak bulur
- **AI Destekli Navigasyon**: Yapay zeka ile sayfaları analiz eder ve otomatik olarak uygun bağlantılara tıklar
- **Otomatik Form Doldurma**: AI'nın kararlarına göre form alanlarını otomatik doldurur
- **HTML Scraping**: Her sayfanın tam HTML içeriğini çeker ve AI'ya gönderir
- **Gerçek Zamanlı Log**: Tüm işlemleri anlık olarak takip edebilirsiniz
- **Akıllı Parça Tespiti**: Bulunan araç parçalarını otomatik olarak tanır ve listeler

## Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. "Geliştirici modu"nu etkinleştirin
3. "Paketlenmemiş eklenti yükle" düğmesine tıklayın
4. Bu klasörü seçin

## Kullanım

1. **Siteye Gidin**: partslink24.com adresine gidin
2. **Eklentiyi Açın**: Chrome araç çubuğundaki eklenti simgesine tıklayın
3. **VIN Girin**: 17 haneli VIN numarasını girin
4. **Parça Adı** (İsteğe bağlı): Aradığınız parça adını girin
5. **Aramayı Başlatın**: "Start AI Scraping" düğmesine tıklayın
6. **Takip Edin**: Log alanından işlemleri takip edin

## AI Entegrasyonu

Eklenti, yerel olarak çalışan Gemini 2.0 Flash modeli ile entegre olacak şekilde tasarlanmıştır. AI şu görevleri yerine getirir:

- **Sayfa Analizi**: HTML içeriğini analiz eder
- **Karar Verme**: Hangi bağlantıya tıklanacağını, hangi formu dolduracağını belirler
- **Parça Tespiti**: Sayfadaki araç parçalarını tanır
- **Navigasyon Planlaması**: Hedefe ulaşmak için en iyi yolu planlar

## Güvenlik ve Gizlilik

- Tüm veriler yerel olarak işlenir
- Hiçbir veri dış sunuculara gönderilmez
- AI modeli yerel olarak çalışır
- Sadece partslink24.com sitesinde çalışır

## Dosya Yapısı

```
├── manifest.json          # Eklenti yapılandırması
├── popup.html             # Kullanıcı arayüzü
├── popup.js               # Popup kontrolcüsü
├── background.js          # AI orkestratörü ve ana logic
├── content.js             # Web scraping ve sayfa etkileşimi
├── injected.js            # Sayfa context'inde çalışan script
├── privacy-policy.md      # Gizlilik politikası
└── README.md              # Bu dosya
```

## Geliştirme

### Önemli Sınıflar

- **AIScrapingOrchestrator**: Ana AI koordinatörü (background.js)
- **PartsLinkScraper**: Web scraping işlemleri (content.js)
- **PopupController**: Kullanıcı arayüzü kontrolü (popup.js)
- **PageInterceptor**: Sayfa etkileşimi (injected.js)

### Debug

Chrome DevTools Console'da şu komutları kullanabilirsiniz:

```javascript
// Background script logs
chrome.runtime.getBackgroundPage(function(bg) { console.log(bg); });

// Content script durumu
partsLinkScraper.isActive;

// Page interceptor
window.partsLinkInterceptor;
```

## Yapılandırma

AI model ayarları background.js dosyasında yapılandırılabilir:

```javascript
const GEMINI_MODEL = "models/gemini-2.0-flash";
const MAX_STEPS = 50; // Maksimum adım sayısı
const STEP_DELAY = 2000; // Adımlar arası bekleme süresi (ms)
```

## Sınırlamalar

- Sadece partslink24.com sitesinde çalışır
- Maksimum 50 adım ile sınırlıdır (sonsuz döngüyü önlemek için)
- AI modeli yerel olarak kurulu olmalıdır
- Chrome eklentisi izinleri gereklidir

## Sorun Giderme

1. **Eklenti Çalışmıyor**: Chrome eklenti sayfasından eklentinin etkin olduğunu kontrol edin
2. **AI Çalışmıyor**: Yerel Gemini modelinin kurulu ve çalışır olduğunu kontrol edin
3. **Sayfa Yüklenmiyor**: Popup'ta görülen hata mesajlarını kontrol edin
4. **Aramalar Başarısız**: VIN numarasının doğru ve 17 haneli olduğunu kontrol edin

## Lisans

Bu proje eğitim ve araştırma amaçlı geliştirilmiştir. Ticari kullanım için uygun lisans alınmalıdır.

## İletişim

Sorularınız için: wanis.mahjor@vekteur.fr