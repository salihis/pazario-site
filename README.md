# Pazar.io - Pazaryeri Yönetim Paneli

Bu proje, Pazar.io platformunun statik demo sürümüdür. GitHub Pages üzerinde otomatik olarak yayınlanmaktadır.

## Proje Yapısı

```text
pazario-site/
├── .github/workflows/deploy.yml  # CI/CD İş Akışı
├── index.html                    # Ana Sayfa (Landing Page)
├── urun-gonderim.html            # Ürün Gönderim Ekranı (Demo)
├── admin.html                    # Admin Panel (Demo)
├── 404.html                      # Hata Yönlendirme Sayfası
└── README.md                     # Dokümantasyon
```

## Kurulum ve Başlangıç (Bir Kerelik)

1. GitHub üzerinde yeni bir **Public** depo oluşturun.
2. Depo ayarlarından (**Settings**) -> **Pages** sekmesine gidin.
3. **Build and deployment** -> **Source** kısmını **GitHub Actions** olarak seçin.
4. Bu projeyi yerel bilgisayarınıza klonlayın, dosyaları ekleyin ve depoya gönderin (`push`).

## Yayınlama (Deploy)

Herhangi bir değişiklik yapıp `main` branch'ine gönderdiğinizde sistem otomatik olarak çalışır:

```bash
git add .
git commit -m "Yeni özellik eklendi"
git push origin main
```

Değişiklikler yaklaşık 30 saniye içinde **Actions** sekmesinde işlenir ve yayına alınır.

## URL Formatı

Yayınlanan sayfalara aşağıdaki formatta erişebilirsiniz:

- **Ana Sayfa:** `https://{username}.github.io/{repo-name}/`
- **Ürün Gönderim:** `https://{username}.github.io/{repo-name}/urun-gonderim.html`
- **Admin Panel:** `https://{username}.github.io/{repo-name}/admin.html`

## Özel Domain (Opsiyonel)

Kendi alan adınızı kullanmak isterseniz:
1. Depo kök dizinine `CNAME` dosyası ekleyin (İçeriği: `demo.pazar.io`).
2. DNS ayarlarınızda `demo` subdomain'i için `{username}.github.io` adresine bir `CNAME` kaydı oluşturun.
3. GitHub **Settings** -> **Pages** altından **Enforce HTTPS** seçeneğini işaretleyin.

## Lokal Geliştirme ve Test

Dosyaları yerel ortamda test etmek için:

**Node.js yüklü ise:**
```bash
npx serve .
```

**Python yüklü ise:**
```bash
python3 -m http.server 3000
```

## Sonraki Adım (v2 — React SPA)

Platformun tam sürümü React ve Vite kullanılarak geliştirilmektedir:
- **Vite + React** geçişi yapıldı.
- `npm run build` komutu ile `dist/` klasörü oluşturulur.
- Backend API için **Railway** veya **Render.com** gibi Node.js destekli platformlar kullanılacaktır.
