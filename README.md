# US Patent Library

FDA Orange Book verilerinden ilaç moleküllerine ait ticari ürünleri ve US patentlerini listeleyen, tek dosyalık web uygulaması.

## Özellikler

- Veriler doğrudan FDA Orange Book API'sinden çekilir: `https://api.fda.gov/drug/orangebook.json`
- Her ticari ürün (Brand + NDA) ayrı başlık altında; her patent tek satırda (US Patent No., Expiration Date)
- Pediatrik uzatmalar (`*PED`) ilgili patentin altında gösterilir
- Her patent için düzenlenebilir **Patent Yorumu** alanı (tarayıcıda saklanır)
- Molekül ekleme, arama/filtreleme ve Excel'e aktarma
- Orange Book'ta bulunmayan kombinasyonlar açıkça belirtilir

## Kullanım

`us-patent-library.html` dosyasını tarayıcıda açın. İnternet bağlantısı gerekir.

İsteğe bağlı olarak yerel sunucu ile: `powershell -ExecutionPolicy Bypass -File serve.ps1` → http://localhost:8765/

## Not

Yorumlar tarayıcının yerel depolamasında tutulur; başka tarayıcı veya bilgisayara taşınmaz. Yedek için düzenli olarak Excel'e aktarın.
