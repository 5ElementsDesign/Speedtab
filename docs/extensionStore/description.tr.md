Speedtab: Sizi takip etmeyen, ultra hızlı, yerel öncelikli (local-first) Yeni Sekme çalışma alanı. Saf Vanilla JS, sıfır framework ve minimum bellek kullanımı ile oluşturuldu.

Speedtab, varsayılan tarayıcı Yeni Sekme sayfasını hızlı, yoğun ve yerel bir Hızlı Erişim (Speed Dial) ve verimlilik panosuyla değiştirir. Hesap yok. Bulut yok. Takip yok. Sadece sizin verileriniz, sizin kurallarınız.

Farklı bağlamlar için özel başlangıç sayfaları oluşturun, bunları modüler ızgaralara bölün ve içeriklerinizi sekmeler halinde düzenleyin. Görsel yer imlerini, RSS/Atom beslemelerini, hızlı notları, kod parçacıklarını, bağlantı listelerini, HTML bileşenlerini ve şifrelenmiş özel notları ultra hızlı, tek bir çalışma alanında birleştirin.

Speedtab yapı, hız ve verileriniz üzerinde tam mülkiyet için tasarlanmıştır:

- hesap gerekmez
- arka plan sunucu hizmeti yok
- bulut bağımlılığı yok
- tarayıcı içinde gerçek yerel depolama (local-first)
- tam veri özgürlüğü için taşınabilir dışa/içe aktarma

Speedtab ile yapabilecekleriniz:

- yer imlerini sayfalar, modüller ve özel sekmeler halinde düzenleyin
- iş akışlarınıza göre uyarlanmış klasik, yüksek performanslı bir Hızlı Erişim deneyiminin keyfini çıkarın
- yer imleriniz için yerel önizleme görselleri ve özel favicon'lar yükleyin
- metin, kod, bağlantı, özel HTML ve şifrelenmiş notlar oluşturun
- YaiTabs altyapısıyla HTML notlarınızın içinde sonsuz, derinlemesine iç içe geçmiş sekme yapıları oluşturun
- RSS/Atom beslemelerini doğrudan başlangıç sayfanızda okuyun
- okundu/okunmadı durumlarını takip edin ve ilgilendiğiniz besleme ögelerini yorumlarla arşivleyin
- görsel temayı, ızgara düzenlerini ve CSS arka planlarını özelleştirin
- çalışma alanınızı kesintisiz dışa/içe aktarma ile tarayıcı profilleri arasında taşıyın

Speedtab tamamen yerel çalışır. Uygulama verileri tarayıcı profilinizdeki IndexedDB içinde güvenle saklanır. Besleme çekme işlemleri uzaktaki bir sunucu tarafından değil, eklentinin kendi arka plan servis çalıştırıcısı (service worker) tarafından yürütülür. Şifrelenmiş notlar AES-GCM ve PBKDF2-SHA256 kullanılarak istemci tarafında korunur. Parolalarınız asla cihazınızdan dışarı çıkmaz.

Jenerik bir başlangıç sayfası veya gizliliği ihlal eden bir bulut panosu yerine gerçek, güçlü bir Yeni Sekme çalışma alanı elde edin.

----------------------------------------
KAPSAMLI SPEEDTAB ÖZELLİK DETAYLARI
----------------------------------------

UYGULAMA KABUĞU VE ÇALIŞMA ALANI MİMARİSİ
• Çalışma alanları veya bağlam kategorileri için özelleştirilebilir çok sayfalı gezinti sunan ekranı kaplayan Uygulama Kabuğu.
• Sayfalar, modüller, koleksiyonlar ve bireysel ögeler için sürükle-bırak yeniden sıralama.
• Tek bir ortak çalışma zamanında O(1) ölçekleme ve sıfır sanal DOM yükü ile çalışan YaiJS ve YEH (Yai Event Hub) destekli olay yönlendirme (event-delegation) çekirdeği.
• 0 ms kullanıcı arayüzü yanıt süresine sahip ultra hafif çekirdek.
• Tam klavye gezintisi ve WCAG 2.1 AA erişilebilirlik desteği (Ok tuşları, Home, End, Enter, Space).
• Anında konumlandırma akışı, mutlak sonuç katmanı ve sayfa içi vurgulama ipuçları içeren genel geciktirilmiş (debounced) başlık araması.
• Görünüm ve düzen kontrolleri:
  - Genel varsayılan duvar kağıdı ve sayfa bazında arka plan geçersiz kılmaları.
  - Canlı sözdizimi doğrulaması ve kayıtlı gradyanlar/renkler için arşiv rafı içeren özel CSS arka plan düzenleyicisi.
  - Modül başına düzen kontrolleri: Otomatik, çok sütunlu yayılım (col-span) ve tam genişlikte ızgara düzenleri.
  - Modül minimum yükseklik kontrolleri ve modüle özel içerik boşluğu (padding) geçersiz kılmaları.
  - Kabuk genişlik sınırları ve widget çubuğu düzen yerleşimi (üst veya alt).

GÖRSEL SIK KULLANILANLAR (BOOKMARKS) MODÜLÜ
• Özel favicon'lar veya yüklenen önizleme görselleri desteğiyle görsel karo işleme.
• Yerel önizleme görseli yüklemelerini kaydetmeden önce sabit bir karo oranına kırpmak için yerleşik kırpma aracı (CropperJS).
• Varlık tarayıcısı ve favicon yöneticisi:
  - IndexedDB varlık tablolarında saklanan tüm favicon'lar arasından seçim yapın.
  - Özel favicon'ları doğrudan yükleyin.
  - Düşük kontrastlı/şeffaf koyu favicon'lar için otomatik algılama ve onarım aracı (kaydetmeden önce temiz bir arka plan katmanı ekler).
• Gezinti ayarları: Modül başına açılma davranışını geçerli sekme ile yeni arka plan/ön plan sekmeleri arasında geçiş yapın.
• Düzen ve Karo Özelleştirme:
  - Varsayılan mod (106x60px görsel önizleme karoları).
  - Hızlı Bağlantılar modu (ultra yoğun 48x48px favicon öncelikli ızgara).
  - Büyük Karolar modu (154x80px büyütülmüş görsel önizlemeler).
  - Etiket odaklı görsel yer imi taraması için isteğe bağlı karo altı başlık düzeni modu.
  - Şeffaflık destekli karo düzeyinde özel arka plan renkleri.

SPEED DIAL MODÜLÜ
• Görsel olarak sade ve şeffaf bir modül kabuğuna sahip, tam genişlikte özel Speed Dial yüzeyi.
• Ayarlanabilir yükseklik ve üst, orta veya alt içerik hizalamasına sahip ortalanmış 16:9 karolar.
• Klasik veya kategorilere ayrılmış Speed Dial düzenleri için isteğe bağlı sekmeler, satır içi ekleme karosu ve tam sayfa yüksekliği modu.
• Görsel başına ayarlanabilir boşluğa sahip yerel Speed Dial görsel varlıkları.
• Favicon renklerinden türetilen karo görselleri, harici ekran görüntüsü veya görsel hizmeti gerektirmez.

NOTLAR VE ETKİLEŞİMLİ NOT MOTORU
• Beş not içerik türü:
  - HTML Notları:
    * Varlık destekli yer tutucu belirteçleri ve satır içi görsellerle temizlenmiş (sanitized) HTML işleme.
    * Doğrudan not içeriği içinde canlı, tamamen etkileşimli YaiTabs iç içe sekme yapıları barındırır.
    * Satır içi stil güvenlik açıkları olmadan Özelliğe Dayalı Stil API'si (genişlik, yükseklik, kenar boşluğu, dolgu, flexbox, grid, kenarlıklar, yarıçaplar, gölgeler, tipografi ve renkler için data-st-* öznitelikleri).
    * Düzen iskeletlerini ve bileşen şablonlarını düzenleyiciye eklemek için önceden ayarlanmış makrolar.
  - Metin Notları: Hızlı, biçimlendirilmemiş notlar için düz metin düzenleyici.
  - Bağlantı Notları: Satır satır URL'leri anında tıklanabilir bağlantı listelerine dönüştürür; URL olmayan metin blokları alıntı bloğu olarak görünür.
  - Kod Notları: Highlight.js aracılığıyla otomatik sözdizimi vurgulamalı eş aralıklı (monospaced) kod parçacığı depolama alanı.
  - Kripto (Crypt) Notları: AES-GCM ve PBKDF2-SHA256 (310.000 yineleme) kullanılarak istemci tarafında şifrelenmiş özel notlar. Şifre çözme için bir parola gerektirir; parolalar asla saklanmaz veya önbelleğe alınmaz.
• Not Düzenleyici Yüzeyi modları:
  - HTML notları için açılıp kapatılabilir canlı önizlemeli varsayılan bölünmüş görünüm (split-view) düzenleyicisi.
  - Uçar Yapılandırma (Flying Config): Derinlemesine iç içe geçmiş HTML notu sekme içeriklerini odaklanmış özel bir yapılandırma yüzeyinden düzenleyin. Doğru içeriği bulmak için artık iç içe geçmiş sekmeler arasında gezinmeye son.
  - Yerel Hızlı Not Not Defteri (Scratchpad): Çalışma alanı dışa aktarmalarından bağımsız olarak saklanan, başlık üzerinden erişilebilir yerel not defteri.
• Yüzen Pencere Sistemi: Notlar, sürüklenebilir, boyutu yeniden adlandırılabilir ve odaklaması katmanlanabilir yüzen pencerelere dönüştürülebilir ve tarayıcı yeniden başlatmalarında durumlarını, konumlarını ve boyutlarını korurlar.

BESLEME (RSS/ATOM) OKUYUCU MODÜLÜ
• Herhangi bir sayfa modülü ızgarasına doğrudan yerleştirilebilir entegre RSS/Atom besleme okuyucu modülü.
• Besleme kaynağı yönetimi: Standart web alan adı URL'lerinden gizli RSS/Atom besleme uç noktalarını ekleyin, doğrulayın ve otomatik keşfedin (auto-discovery).
• Okuyucu yetenekleri:
  - Kaynak filtreleme ve özelleştirilebilir görünür makale sınırları.
  - Toplu işaretleme eylemleriyle okundu ve okunmadı ögesi durumu takibi.
  - Makaleleri isteğe bağlı kullanıcı yorumlarıyla yerel olarak kaydetmek için öge arşiv yöneticisi.
  - Genişletilmiş Okuyucu Görünümü: Ayarlanabilir okuma sütunu genişlik seçicileriyle besleme modüllerini özel bir tam genişlikte okuma görünümüne büyütün.
  - Yüklenen makaleleri gerçek zamanlı olarak aramak için modül içi yerel metin filtresi girişi.
  - Sekme etkinken isteğe bağlı modül başına otomatik yenileme döngüsü.
  - Çapraz kaynaklı (cross-origin) besleme çekme işlemleri arka plan servis çalıştırıcısı tarafından güvenle yürütülür.

WIDGET ÇUBUĞU VE YARDIMCI ARAÇLAR
• Ana çalışma alanı sayfalarının üstüne veya altına yerleştirilebilen modüler widget çubuğu.
• Saat ve Zaman Araçları:
  - Açılıp kapatılabilir Dijital veya Analog saat görüntüleme modları.
  - Yerelleştirilmiş tarih/saat dizesi biçimlendirmesi, belirteç ekleme yardımcıları, özel yazı tipi boyutlandırma, hizalama ve parça başına öge renkleri.
  - Sıfır kayıplı gerçek DOM işleme döngüsünde çalışan yerel Kronometre ve Çoklu Zamanlayıcı araçları.
• Hava Durumu Sistemi:
  - Özel konum araması ve birim geçişleri (Celsius/Fahrenheit) içeren kompakt çubuk sıcaklık göstergesi.
  - Doğrudan çubuk göstergesinden erişilebilen detaylı haftalık hava durumu tahmini penceresi.
• Sistem durumu için görsel geri bildirim içeren uzaktan eşitleme durum göstergesi.

BAĞLAM MENÜSÜ YAKALAMA VE GELEN KUTUSU (INBOX)
• Tarayıcı Bağlam Menüsü Entegrasyonu: Etkin sekmeden ayrılmadan "Hızlı Nota Ekle" komutunu çalıştırmak için herhangi bir web sayfasına veya metin seçimine sağ tıklayın.
• Canlı Bekleyen Sayacı: Arka plan sekme başlığı, dosyalanmamış sıra sayılarını yansıtacak şekilde dinamik olarak güncellenir (ör. INBOX [3] - Speedtab).
• Gelişmiş Gelen Kutusu Yöneticisi: Yakalanan klipsleri incelemek, düzenlemek, filtrelemek ve belirli yer imi veya not modüllerine kaydetmek için özel başlık çekmecesi.

VERİ MÜLKİYETİ, DEPOLAMA VE UZAKTAN EŞİTLEME
• %100 Yerel Öncelikli Depolama: Tüm uygulama durumu, modül yapıları ve ikili varlıklar Dexie aracılığıyla istemci tarafındaki IndexedDB içinde saklanır.
• Taşınabilir JSON Veri Değişimi:
  - Doğrulanmış JSON dışa aktarma dosyaları (speedtab-export-<checksum>.json).
  - Çalışma alanlarını kayıt tekrarı olmadan tarayıcı profilleri arasında taşımak için kimlik farkındalığına sahip kayıt birleştirme motoru.
  - Yalıtılmış içe/dışa aktarma yardımcı yüzeyi (import-export.html).
• İsteğe Bağlı Uzaktan Bulut Eşitlemesi:
  - WebDAV Eşitlemesi: Manuel gönderme, çekme, uzaktan içerik karşılaştırması ve durum kontrolleri.
  - Google Drive Eşitlemesi: Otomatik otomatik gönderme zamanlayıcı aralıkları ve uzaktan çalışma alanı durum doğrulamaları dahil olmak üzere, kullanıcının gizli uygulama veri klasörüne chrome.identity üzerinden OAuth destekli eşitleme.

SİSTEM BAKIMI VE IZGARA SIRALAYICI
• Özel İzgara Sıralayıcı (sorter.html): Çalışma alanı sayfa hiyerarşilerini yeniden düzenlemek, sekme başlıklarını satır içinde düzenlemek ve kademeli silme işlemlerini gerçekleştirmek için yalıtılmış yapılandırma sayfası.
• Sistem Temizlik Yöneticisi: Sahipsiz kalmış kayıtları, kullanılmayan ikili varlıkları ve eski favicon'ları tespit edip temizlemek için yerel veritabanı tablolarını tarayın.

ULUSLARARASI LAŞTIRMA VE YEREL DİL DESTEĞİ
• Yerel chrome.i18n altyapısı üzerine kurulmuş eklenti uluslararasılaştırması.
• Türkçe, İngilizce, Almanca, Felemenkçe, Hintçe, Rusça ve Çince (basitleştirilmiş) için tam kullanıcı arayüzü çevirileri ve yerelleştirilmiş örnek çalışma alanları.


----------------------------------------
PERFORMANS VE BOYUT
----------------------------------------

• Sıkıştırılmış eklenti boyutu: ~580 KB
• Chrome Görev Yöneticisi:
  - Bellek: ~50 MB toplam bellek / ~5 MB canlı JavaScript yığını
  - CPU kullanımı: Etkin kullanım sırasında %1-10
  - Tüm eklenti için toplamda sadece ~40 olay dinleyicisi (event listener)
  - 0 ms kullanıcı arayüzü yanıt süresi (sanal DOM yükü yok)
