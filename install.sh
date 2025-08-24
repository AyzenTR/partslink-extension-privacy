#!/bin/bash

# PartsLink AI Scraper Extension Installation Helper
# Bu script Chrome extension kurulumunu kolaylaştırır

echo "🚗 PartsLink AI Scraper Extension Kurulum Yardımcısı"
echo "=================================================="

# Chrome'un kurulu olup olmadığını kontrol et
if command -v google-chrome >/dev/null 2>&1; then
    CHROME_CMD="google-chrome"
elif command -v google-chrome-stable >/dev/null 2>&1; then
    CHROME_CMD="google-chrome-stable"
elif command -v chromium >/dev/null 2>&1; then
    CHROME_CMD="chromium"
else
    echo "❌ Chrome/Chromium bulunamadı. Lütfen Chrome'u kurun."
    exit 1
fi

echo "✅ Chrome bulundu: $CHROME_CMD"

# Dosyaların varlığını kontrol et
REQUIRED_FILES=("manifest.json" "background.js" "content.js" "popup.html" "popup.js")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo "❌ Gerekli dosyalar eksik:"
    printf '%s\n' "${MISSING_FILES[@]}"
    exit 1
fi

echo "✅ Tüm gerekli dosyalar mevcut"

# JavaScript syntax kontrolü
echo "🔍 JavaScript dosyalarını kontrol ediliyor..."

for jsfile in background.js content.js popup.js injected.js; do
    if ! node -c "$jsfile" 2>/dev/null; then
        echo "❌ $jsfile syntax hatası var"
        exit 1
    fi
done

echo "✅ JavaScript dosyaları geçerli"

# JSON geçerliliği kontrolü
if ! python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null; then
    echo "❌ manifest.json geçersiz"
    exit 1
fi

echo "✅ manifest.json geçerli"

# Extension dizinini oluştur
EXTENSION_DIR="$(pwd)"
echo "📁 Extension dizini: $EXTENSION_DIR"

echo ""
echo "🎯 Kurulum Adımları:"
echo "1. Chrome'u açın"
echo "2. Adres çubuğuna 'chrome://extensions/' yazın"
echo "3. Sağ üst köşeden 'Geliştirici modu'nu etkinleştirin"
echo "4. 'Paketlenmemiş eklenti yükle' düğmesine tıklayın"
echo "5. Bu dizini seçin: $EXTENSION_DIR"
echo ""

# Demo sayfasını aç
if [ -f "demo.html" ]; then
    read -p "Demo sayfasını açmak ister misiniz? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $CHROME_CMD "file://$(pwd)/demo.html" 2>/dev/null &
        echo "🌐 Demo sayfası açıldı"
    fi
fi

echo ""
echo "📋 Kurulum tamamlandıktan sonra:"
echo "- partslink24.com'a gidin"
echo "- Chrome araç çubuğundaki eklenti simgesine tıklayın"
echo "- VIN numaranızı girin ve aramayı başlatın"
echo ""
echo "💡 Sorun yaşarsanız README.md dosyasını kontrol edin"
echo "📧 İletişim: wanis.mahjor@vekteur.fr"