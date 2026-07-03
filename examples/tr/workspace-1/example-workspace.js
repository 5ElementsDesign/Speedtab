const exampleWorkspaceDefinition = [
  /**
   * Page: Ana
   * Module: Notlar
   * Tab: Başlangıç
   */
  {
    page: 'Ana',
    module: 'Notlar',
    tab: 'Başlangıç',
    type: 'text',
    colorScheme: 'success',
    title: 'İlk notum',
    content: `Sırrı açmak için 'Gizli' parolasını kullan`,
  },
  {
    page: 'Ana',
    module: 'Notlar',
    tab: 'Başlangıç',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Gizli',
    title: 'Gizli',
    content: `Speedtab harika!`,
  },
  {
    page: 'Ana',
    module: 'Notlar',
    tab: 'Başlangıç',
    type: 'html',
    colorScheme: 'primary',
    title: 'Speedtab’e hoş geldiniz',
    content: `
<h2>Speedtab’e hoş geldiniz</h2>
<p> Speedtab; yer imleri, notlar, akışlar, varlıklar, uzak senkronizasyon ve taşınabilir dışa aktarımlar için modüler bir yeni sekme çalışma alanıdır. </p>
<blockquote>
  <p> Bu not bir <strong>HTML notudur</strong>. Düz metinden daha zengin bir yapı kullanabilir ve yine de her şeyi Speedtab içinde tutabilirsiniz. </p>
</blockquote>
<figure class="st-note-html-favicon-row">
  {{asset:image:1}}
  {{asset:image:2}}
  {{asset:image:3}}
</figure>
<h3>Öne çıkanlar</h3>
<table>
  <thead>
    <tr> <th>Özellik</th> <th>Ne işe yarar</th> </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Yer İmleri</strong></td>
      <td>Sekmeli koleksiyonlar, önizleme görselleri, quicklinks ve favicon yönetimi.</td>
    </tr>
    <tr>
      <td><strong>Notlar</strong></td>
      <td>Metin, kod, bağlantılar, şifreli notlar ve artık yapılandırılmış HTML notları.</td>
    </tr>
    <tr>
      <td><strong>Akışlar</strong></td>
      <td>Kaynak yönetimi ve yerel okuma araçlarıyla RSS ve Atom okuma.</td>
    </tr>
    <tr>
      <td><strong>Uzak Senkronizasyon</strong></td>
      <td>Durum karşılaştırmaları, arşiv anlık görüntüleri ve onarım kontrolleriyle WebDAV push ve pull.</td>
    </tr>
    <tr>
      <td><strong>Bileşenler</strong></td>
      <td>Normal modül ızgarasından bağımsız, hava durumu gibi genel araç rayı bileşenleri.</td>
    </tr>
  </tbody>
</table>
<h3>Bilmekte fayda var</h3>
<ul>
  <li>Yerel dışa aktarma ve uzak senkronizasyon iki ayrı kavramdır.</li>
  <li>Şifrelenmiş notlar, parola girilene kadar kilitli kalır.</li>
  <li>Açık notlar, küçük uygulama pencereleri gibi sayfanın üzerinde durabilir.</li>
  <li>HTML notları, gösterilmeden önce temizlenir.</li>
</ul>
<h3>Örnek düzen içeriği</h3>
<p> HTML notları; kompakt panolar, başlangıç kartları, rehberler, değişiklik günlükleri ve küçük dokümantasyon blokları için çok uygundur. </p>
<pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome Web Mağazası&lt;/a&gt;</code></pre>
<p> <small>Yararlı bağlantı:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Chrome Web Mağazası’nda Speedtab </a> </p>
<hr>
<p> <strong>İpucu:</strong> Bu not bir başlangıç şablonu olarak tasarlandı. Kopyalayın ve bölümleri kendi pano rehberinizle değiştirin. </p>
    `,
  },
]

export default exampleWorkspaceDefinition
