# US Patent Database

FDA Orange Book verilerinden ilaç moleküllerine ait ticari ürünleri ve US patentlerini listeleyen, kullanıcı girişli web uygulaması. Vercel üzerinde çalışır.

## Sayfalar

- `login.html`: giriş ekranı
- `index.html`: ana sayfa (molekül arama, yeni analiz, kütüphane bağlantısı)
- `library.html`: US Patent Kütüphanesi, yani tüm moleküllerin listesi
- `molecule.html?id=…`: bir molekülün ürünleri ve patentleri (US Patent No., Expiration Date, Patent Yorumu)
- `profile.html`: ad/e-posta düzenleme ve şifre değiştirme

## Mimari

- Patent verileri tarayıcıdan doğrudan FDA Orange Book API'sinden çekilir: `https://api.fda.gov/drug/orangebook.json`
- `api/` altındaki Vercel fonksiyonları kullanıcıları, molekül listesini ve patent yorumlarını yönetir
- Veriler Upstash Redis'te tutulur; yorumlar ve molekül listesi tüm kullanıcılar için ortaktır
- Şifreler PBKDF2-SHA256 ile hash'lenir; oturum imzalı, HttpOnly bir çerezle tutulur

## Vercel ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis entegrasyonu ekleyince Vercel bunları otomatik tanımlar (`UPSTASH_REDIS_REST_URL`/`_TOKEN` da desteklenir) |
| `SESSION_SECRET` | Oturum çerezlerini imzalayan en az 32 karakterlik rastgele metin |
| `SEED_USERS` | İlk kullanıcıların hash'lenmiş şifreleri (JSON). Kullanıcı ilk girişte veritabanına aktarılır; sonraki şifre değişiklikleri veritabanında tutulur |

`SEED_USERS` ve `SESSION_SECRET` değerleri repoya eklenmez.
