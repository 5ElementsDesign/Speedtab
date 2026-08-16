const exampleWorkspaceDefinition = [
  /**
   * Page: Main
   * Module: Notes
   * Tab: Start
   */
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Start',
    type: 'text',
    colorScheme: 'success',
    title: 'Mijn eerste notitie',
    content: `Gebruik de wachtzin 'Secret' om het geheim te ontgrendelen`,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Start',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Secret',
    title: 'Geheim',
    content: `Speedtab is geweldig!`,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Start',
    type: 'html',
    colorScheme: 'primary',
    title: 'Welkom bij Speedtab',
    content: `
<div data-yai-tabs="" data-nav="top" data-theme="light" data-color-accent="primary" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
  <nav data-controller="">
    <button data-tab-action="open" data-open="1" data-default="">Welkom</button>
    <button data-tab-action="open" data-open="2">Goed om te weten</button>
  </nav>
  <div data-content="">
    <div data-tab="1" class="p-3">
      <div data-swipe-ignore>
        <h2>Welkom bij Speedtab</h2>
        <p> Speedtab is een modulaire werkruimte op het nieuwe tabblad voor bladwijzers, notities, feeds, bestanden, externe synchronisatie en overdraagbare exports. </p>
        <blockquote>
          <p> Deze notitie is een <strong>HTML-notitie</strong>. Je kunt een rijkere structuur gebruiken dan platte tekst, terwijl alles volledig lokaal binnen Speedtab blijft. </p>
        </blockquote>
        <figure class="st-note-html-favicon-row">
          {{asset:image:1}}
          {{asset:image:2}}
          {{asset:image:3}}
        </figure>
        <h3>Hoogtepunten</h3>
        <table>
          <thead>
            <tr> <th>Functie</th> <th>Wat het doet</th> </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Bladwijzers</strong></td>
              <td>Verzamelingen met tabbladen, voorbeeldafbeeldingen, snelkoppelingen en favicon-beheer.</td>
            </tr>
            <tr>
              <td><strong>Notities</strong></td>
              <td>Tekst, code, links, versleutelde notities en gestructureerde HTML-notities.</td>
            </tr>
            <tr>
              <td><strong>Feeds</strong></td>
              <td>RSS- en Atom-lezer met bronbeheer en lokale hulpmiddelen.</td>
            </tr>
            <tr>
              <td><strong>Externe synchronisatie</strong></td>
              <td>WebDAV- en Google Drive-synchronisatie met statusvergelijking, archiefmomentopnamen en herstelcontroles.</td>
            </tr>
            <tr>
              <td><strong>Widgets</strong></td>
              <td>Globale balk-widgets zoals het weer en de klok, onafhankelijk van het normale modulerooster.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div data-tab="2" class="p-3">
      <div data-swipe-ignore>
        <h2>Goed om te weten</h2>
        <ul>
          <li>Lokale export en externe synchronisatie zijn twee afzonderlijke functies.</li>
          <li>Versleutelde notities blijven vergrendeld totdat een wachtzin wordt ingevoerd.</li>
          <li>Geopende notities kunnen als een zwevend venster boven de pagina worden geplaatst.</li>
          <li>HTML-notities worden voor het renderen altijd veilig gezuiverd.</li>
        </ul>
        <h3>Voorbeeld van indeling</h3>
        <p> HTML-notities werken uitstekend voor compacte dashboards, introductiekaarten, handleidingen, wijzigingslogboeken en kleine documentatieblokken. </p>
        <pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome Web Store&lt;/a&gt;</code></pre>
        <p> <small>Nuttige link:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Speedtab in de Chrome Web Store </a> </p>
        <hr>
        <p> <strong>Tip:</strong> Deze notitie is bedoeld als startsjabloon. Dupliceer deze notitie en vervang de secties door je eigen dashboardhandleiding. </p>
      </div>
    </div>
  </div>
</div>
    `,
  },
]

export default exampleWorkspaceDefinition
