const exampleWorkspaceDefinition = [
  /**
   * Page: Main
   * Module: Notizen
   * Tab: Start
   */
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Start',
    type: 'text',
    colorScheme: 'success',
    title: 'Meine erste Notiz',
    content: `Nutze die Passphrase 'Geheimnis', um das Geheimnis zu entschlüsseln`,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Start',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Geheimnis',
    title: 'Geheimnis',
    content: `Speedtab ist der Hammer!`,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Start',
    type: 'html',
    colorScheme: 'primary',
    title: 'Willkommen bei Speedtab',
    content: `
<div data-yai-tabs="" data-nav="top" data-theme="light" data-color-accent="primary" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
  <nav data-controller="">
    <button data-tab-action="open" data-open="1" data-default="">Willkommen</button>
    <button data-tab-action="open" data-open="2">GZW</button>
  </nav>
  <div data-content="">
    <div data-tab="1" class="p-3">
      <div data-swipe-ignore>
        <h2>Willkommen bei Speedtab</h2>
        <p> Speedtab ist ein modularer Neuer-Tab-Workspace für Lesezeichen, Notizen, Feeds, Assets, Remote-Synchronisierung und portable Exporte. </p>
        <blockquote>
          <p> Diese Notiz ist eine <strong>HTML-Notiz</strong>. Du kannst reichhaltigere Strukturen nutzen als bei reinem Text und trotzdem alles direkt in Speedtab behalten. </p>
        </blockquote>
        <figure class="st-note-html-favicon-row">
          {{asset:image:1}}
          {{asset:image:2}}
          {{asset:image:3}}
        </figure>
        <h3>Highlights</h3>
        <table>
          <thead>
            <tr> <th>Feature</th> <th>Was es macht</th> </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Lesezeichen</strong></td>
              <td>Tabbasierte Sammlungen, Vorschaubilder, Quicklinks und Favicon-Handling.</td>
            </tr>
            <tr>
              <td><strong>Notizen</strong></td>
              <td>Text, Code, Links, verschlüsselte Notizen und jetzt auch strukturierte HTML-Notizen.</td>
            </tr>
            <tr>
              <td><strong>Feeds</strong></td>
              <td>RSS- und Atom-Reader mit Quellenverwaltung und lokalen Lese-Tools.</td>
            </tr>
            <tr>
              <td><strong>Remote Sync</strong></td>
              <td>WebDAV-Push und -Pull mit Statusvergleich, Archiv-Snapshots und Reparatur-Prüfungen.</td>
            </tr>
            <tr>
              <td><strong>Widgets</strong></td>
              <td>Globale Widgets in der Schiene (wie das Wetter), unabhängig vom normalen Modul-Raster.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div data-tab="2" class="p-3">
      <div data-swipe-ignore>
        <h2>Gut zu wissen</h2>
        <ul>
          <li>Lokaler Export und Remote-Sync sind getrennte Konzepte.</li>
          <li>Verschlüsselte Notizen bleiben gesperrt, bis eine Passphrase eingegeben wird.</li>
          <li>Geöffnete Notizen können wie kleine App-Fenster frei über der Seite schweben.</li>
          <li>HTML-Notizen werden vor dem Rendern bereinigt (sanitised).</li>
        </ul>
        <h3>Beispiel für Layout-Inhalte</h3>
        <p> HTML-Notizen eignen sich hervorragend für kompakte Dashboards, Onboarding-Karten, Leitfäden, Changelogs und kleine Dokumentationsblöcke. </p>
        <pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome Web Store&lt;/a&gt;</code></pre>
        <p> <small>Nützlicher Link:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Speedtab im Chrome Web Store </a> </p>
        <hr>
        <p> <strong>Tipp:</strong> Diese Notiz ist als Starter-Vorlage gedacht. Dupliziere sie einfach und ersetze die Abschnitte durch deinen eigenen Dashboard-Leitfaden. </p>
      </div>
    </div>
  </div>
</div>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Start',
    type: 'html',
    colorScheme: 'dark',
    title: 'Tabby Tabs',
    content: `
<div
  data-yai-tabs
  data-nav="top"
  data-theme="dark"
  data-color-accent="secondary"
  data-behavior="zoom"
  data-swipe
  data-auto-accessibility="false"
  data-closable="false">
  <header data-tabs-header>
    <div data-header-content class="p-3">
      <p class="m-0 last-p">Jede Tab-Komponente kann ihren eigenen Header haben. Immer oben sichtbar.</p>
    </div>
  </header>
  <nav data-controller>
    <button data-tab-action="open" data-open="1" data-default>Intro</button>
    <button data-tab-action="open" data-open="2">Nutzung</button>
  </nav>
  <div data-content>
    <div data-tab="1" data-spaceless>
      <div data-yai-tabs data-nav="left" data-color-accent="warning" data-behavior="blur" data-closable="false" data-swipe>
        <nav data-controller>
          <button data-tab-action="open" data-open="1" data-default>Speedtab</button>
          <button data-tab-action="open" data-open="2">YaiTabs</button>
          <button data-tab-action="open" data-open="3">Tabbed Browsing</button>
        </nav>
        <div data-content>
          <div data-tab="1" class="p-2">
            <div data-swipe-ignore>
              <h2>Speedtab</h2>
              <p>Ein völlig neues Tab-Erlebnis</p>
              <p>
                <small>💡 <strong>Sofortiger Pro-Tipp:</strong> Kopiere das gesamte <code>input element</code> aus dieser Notiz
                und füge es in einen beliebigen Inhaltsbereich in dieser Notiz ein. Es funktioniert sofort.</small>
              </p>
              <p>Ja, klar. Und was genau ist ein "Inhaltsbereich"?</p>
              <p title="Speedy">Wir kommunizieren hier gerade in <b>data-tab="1"</b>. Alles darin, vom Titel bis hierher, ist der Inhaltsbereich. Oder wenn Text einfach wie Text aussieht und nicht wie etwas anderes, ist das normalerweise auch ein Inhaltsbereich.</p>
              <p class="m-0 last-p">
                <small><strong>PS-Tipp:</strong> Wenn du hellere Farben bevorzugst, klicke auf Bearbeiten und ersetze das erste "dark", das du im Input-Element siehst, durch "light".</small>
              </p>
            </div>
          </div>
          <div data-tab="2" class="p-2">
            <div data-swipe-ignore>
              <h2>YaiTabs</h2>
              <p>Eine neue Tab-Implementation</p>
              <p>Leider ist alles, was wir hier sagen könnten, rein technischer Natur, also im Grunde ziemlich langweilig – wir überspringen es einfach.</p>
              <p class="m-0 last-p"><a href="https://yaijs.github.io/yai/" target="_blank" rel="noopener nofollow">YaiJS auf Github</a></p>
            </div>
          </div>
          <div data-tab="3" class="p-2">
            <div data-swipe-ignore>
              <h2>Tabbed Browsing Interface</h2>
              <blockquote>
                <p class="m-0 last-p">Schnellerer Zugriff auf eine größere Anzahl von Tabs</p>
              </blockquote>
              <p>Wie die meisten Daten in dieser Notiz dienen auch diese Daten als Platzhalter für Präsentationszwecke.</p>
              <p>Aber die linke Navigation sieht so gut aus, dass ich einfach Seiten hinzufügen möchte, nur um mehr Nav-Items darin zu haben.</p>
              <p>Kann mich kaum zurückhalten – zu verlockend…</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="2" data-spaceless>
      <div data-yai-tabs data-nav="bottom" data-color-accent="success" data-behavior="blur" data-closable="false" data-swipe data-spaceless>
        <nav data-controller>
            <button data-tab-action="open" data-open="1" data-default>How to</button>
            <button data-tab-action="open" data-open="2">Attribute</button>
        </nav>
        <div data-content>
          <div data-tab="1">
            <h2>Wie bekomme ich YaiTabs?</h2>
            <p>Da du das hier lesen kannst, hast du YaiTabs bereits! Gern geschehen!</p>
            <p>Aber: YaiTabs funktioniert nur in Notizen vom Typ <b>html</b> (der Standardtyp beim Erstellen von Notizen).</p>
            <blockquote>
              <p class="m-0 last-p">Nun, technisch gesehen treibt YaiTabs auch die Seitennavigation und die Tabs in jedem Modul sowie praktisch alle Interaktionen innerhalb von Speedtab an. Es ist dasselbe zugrunde liegende System, das Ressourcen hocheffizient teilt wie friedliche Hippies. Gerade genug, um perfekt auszukommen. Aber das nur am Rande.</p>
            </blockquote>
            <p>Klicke nach dem Erstellen einer Notiz über dem Eingabefeld auf "Tabber". Das wirft dich direkt in eine brandneue Komponente namens "<b title="Steht in keiner Verbindung zu Sabby Sabs">Tabby Tabs</b>".</p>
            <p>Sie enthält sofort 2 fertige Tabs und Inhaltsbereiche. Wenn du mehr benötigst, kopiere sie einfach anhand des bestehenden Musters oder klicke so oft auf "Tabber", wie du willst (intern wird einfach dasselbe Beispiel-Markup unverändert kopiert; Änderungen sind nicht notwendig).</p>
            <p>Und warum genau wollte ich Speedtab nochmal? Den Teil habe ich wohl verpasst.</p>
            <p class="m-0 last-p">Weil Speedtab jetzt teilweise aus YaiTabs besteht, was es vollkommen YAI und daher YEH macht! Das sind direkt 3 Gründe auf einmal!</p>
          </div>
          <div data-tab="2" data-spaceless>
            <div data-yai-tabs data-color-accent="danger" data-behavior="blur" data-closable="false" data-swipe data-nav="right">
              <nav data-controller>
                <button data-tab-action="open" data-open="1" data-default>DOCS</button>
                <button data-tab-action="open" data-open="2">Attribut-Details</button>
              </nav>
              <div data-content>
                <div data-tab="1">
                  <h2>DOCs</h2>
                  <p class="m-0 last-p">Übersprungen, weil langweilig…</p>
                </div>
                <div data-tab="2">
                  <h2>Attributgesteuerte Architektur</h2>
                  <p>Attri-was? Was soll das überhaupt bedeuten?</p>
                  <p>Attribute sind Strings. Viele Features können über Attribute an- und ausgeschaltet werden – im Grunde, indem man Strings in Strings einfügt.</p>
                  <table data-swipe-ignore>
                    <thead>
                      <tr> <th>Attribut</th> <th>Beschreibung</th> <th>Details</th> </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><b class="text-truncate">data-yai-tabs</b></td>
                        <td>Tab-Komponente</td>
                        <td>Kann browser-erschütternd tiefe Ebenen verschachtelter Komponenten verarbeiten.</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-theme="light"</b></td>
                        <td>Farb-Preset</td>
                        <td>light, dark (light ist der Standard)</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-nav="top"</b></td>
                        <td>Tab-Navigation (bottom kehrt tabs-header und tabs-footer um)</td>
                        <td>top, left, right, bottom</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-color-accent="warning"</b></td>
                        <td>Aktive Tab-Farbe</td>
                        <td>primary, secondary, success, warning, danger, dark, light</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-behavior="fade"</b></td>
                        <td>Wechsel-Effekt</td>
                        <td>fade, slide-down, slide-up, slide-left, slide-right, blur, zoom, flip, instant</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-swipe</b></td>
                        <td>Aktiviert YaiSwipe für diese Komponente. Swipes funktionieren über alle Ebenen hinweg.</td>
                        <td>YAI + YEH = SUN</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-auto-accessibility="false"</b></td>
                        <td>In der ersten Tab-Komponente aktivieren, verschachtelte Komponenten erben automatisch.</td>
                        <td>Verschachtelte Komponenten erben immer Theme, Accent und Behavior. Du kannst sie pro Ebene anpassen.</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-closable="false"</b></td>
                        <td>Dies ist nicht ARIA-konform, also überlassen wir es dir...</td>
                        <td>true / false</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer data-tabs-footer>
    <div data-footer-content class="p-3">
      <p class="m-0 last-p">Jede Tab-Komponente kann ihren eigenen Footer haben. Immer unten sichtbar.</p>
    </div>
  </footer>
</div>
    `,
  },

  /**
   * Page: Main
   * Module: Notizen
   * Tab: Funktionen
   */
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'secondary',
    type: 'html',
    title: 'Lesezeichen',
    content: `
<h2>Lesezeichen</h2>
<p>Speedtab-Lesezeichen sind in Modulen und Tabs organisiert, sodass eine einzige Seite alles enthalten kann – von einem fokussierten Arbeits-Setup bis hin zu einem gemischten Dashboard für Tools, Lesestoff und tägliche Abkürzungen.</p>
<ul>
  <li><strong>Reguläre Lesezeichen-Kacheln</strong> können Titel, Beschreibungen, Favicons oder benutzerdefinierte Vorschaubilder anzeigen.</li>
  <li><strong>Der Quicklinks-Modus</strong> verwandelt einen Lesezeichen-Tab in einen kompakten Launcher mit fixierten Favicon-Kacheln (50x50px).</li>
  <li><strong>Benutzerdefinierte Favicons</strong> ermöglichen es dir, das Standard-Icon zu überschreiben, wenn du ein saubereres visuelles System bevorzugst.</li>
  <li><strong>Das Öffnungs-Verhalten</strong> kann deiner globalen Präferenz folgen oder individuell pro Modul angepasst werden.</li>
</ul>
<blockquote>
  <p>Nutze Lesezeichen-Module für Struktur und Quicklink-Module für nackte Geschwindigkeit.</p>
</blockquote>
<p>Du kannst Inhalte auch später flexibel zwischen Tabs verschieben oder kopieren, sodass das Reorganisieren deines Setups nicht bedeutet, es neu bauen zu müssen.</p>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'secondary',
    type: 'html',
    title: 'Notizen',
    content: `
<h2>Notizen</h2>
<p>Notizen sind mehr als nur reiner Text. Speedtab ermöglicht es dir, verschiedene Notiz-Typen zu mischen, sodass eine Seite als Dashboard, Schmierblock, Mini-Wissensdatenbank oder privater Referenzbereich dienen kann.</p>
<ul>
  <li><strong>Text-Notizen</strong> sind ideal für Erinnerungen, Listen und schnelle, strukturierte Notizen.</li>
  <li><strong>HTML-Notizen</strong> können reichhaltigere Layouts für Leitfäden, Callouts und gestylte Infoblöcke rendern.</li>
  <li><strong>Code-Notizen</strong> unterstützen Syntax-Highlighting für Snippets und Konfigurations-Referenzen.</li>
  <li><strong>Verschlüsselte Notizen</strong> sperren sensible Inhalte sicher hinter einer Passphrase.</li>
  <li><strong>Link-Notizen</strong> verwandeln eine einzelne Notiz in eine kleine, kuratierte Link-Sammlung.</li>
</ul>
<p>Öffne eine Notiz, um sie frei über der Seite schweben zu lassen, ihre Größe zu ändern oder sie im Blick zu behalten, während du an anderer Stelle in Speedtab weiterarbeitest.</p>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'secondary',
    type: 'html',
    title: 'Feed-Reader',
    content: `
<h2>Feed-Reader</h2>
<p>Feed-Module verwandeln Speedtab in eine leichtgewichtige Nachrichtenzentrale. Du kannst deine Quellen in Tabs gruppieren, Updates direkt auf der Neuen-Tab-Seite verfolgen und Einträge archivieren, die du behalten willst.</p>
<ul>
  <li><strong>RSS- und Atom-Feeds</strong> können direkt neben Lesezeichen und Notizen auf derselben Seite leben.</li>
  <li><strong>Die Suche innerhalb von Feeds</strong> hilft dir, große Quellenlisten extrem schnell zu filtern.</li>
  <li><strong>Archivierte Einträge</strong> erlauben es dir, wichtige Artikel dauerhaft zu sichern, selbst wenn sie aus dem Live-Feed der Website verschwinden.</li>
  <li><strong>Der erweiterte Lesemodus</strong> gibt Feed-Modulen mehr Breite, wenn eine Quelle eine großzügigere Textdarstellung benötigt.</li>
</ul>
<blockquote>
  <p>Es ist ein fokussierter Feed-Reader, der direkt in dein Dashboard integriert ist – keine separate App, die um deine Aufmerksamkeit kämpfen muss.</p>
</blockquote>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'warning',
    type: 'html',
    title: 'Wetter-Widget',
    content: `
<h2>Wetter-Widget</h2>
<p>Die Widget-Schiene (Rail) lebt außerhalb des normalen Modul-Rasters und ist für kleine, immer verfügbare Informationsblöcke gedacht. Das erste Widget ist das Wetter, mit einem kompakten Layout, das sich dezent im Hintergrund hält.</p>
<ul>
  <li><strong>Platzierung in der oberen oder unteren Schiene</strong>, je nachdem, welches Layout du für deinen Workflow bevorzugst.</li>
  <li><strong>Linksbündige, zentrierte oder rechtsbündige</strong> Ausrichtung in der Schiene.</li>
  <li><strong>Einstellbares Aktualisierungsintervall</strong> und frei wählbare Einheiten (Metrisch/Imperial).</li>
  <li><strong>Standortsuche</strong> direkt in den Einstellungen integriert, komplett ohne datenschutzunfreundliche Geolokalisierungs-Abfragen.</li>
</ul>
<p>Wenn kein Standort hinterlegt ist, bleibt das Widget als unaufdringlicher Platzhalter sichtbar, bis du es konfigurierst.</p>
<hr>
<p><small>Das Widget-System ist darauf ausgelegt, zu wachsen – das Wetter ist erst der Anfang.</small></p>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'primary',
    type: 'html',
    title: 'Assets',
    content: `
<h2>Assets</h2>
<p>Speedtab speichert Bilder und Favicons direkt mit dem Rest deines Workspace, weil sie elementar dafür sind, wie dein Dashboard tatsächlich aussieht und sich anfühlt.</p>
<ul>
  <li><strong>Lesezeichen-Vorschaubilder</strong> sind Teil deiner Layout-Arbeit. Ein angepasstes Dashboard sollte dauerhaft angepasst bleiben und nach einem Sync oder Import nicht wieder zurückgesetzt werden.</li>
  <li><strong>Favicons</strong> werden über einen externen Dienst geladen, da dies der zuverlässigste Weg ist, sie zu finden. Diese Anfragen müssen jedoch mindestens einmal stattfinden.</li>
  <li><strong>Gespeicherte Favicon-Assets</strong> verhindern, dass dieselben Lesezeichen bei jedem Laden deines Dashboards riesige Mengen wiederholter Netzwerkanfragen auslösen.</li>
  <li><strong>Hintergrundbilder und Notiz-Bilder</strong> sind offensichtlicher Workspace-Inhalt, sodass sie mit deinen Seiten, Notizen und Einstellungen über Geräte hinweg wandern.</li>
</ul>
<hr>
<h3>Warum nicht einfach alles jedes Mal neu laden?</h3>
<p>Einige Seiten haben fehlerhafte Icons, lokale URLs, Weiterleitungen oder temporäre Fehler. Das lokale Speichern von Favicon-Assets bedeutet, dass Speedtab sie einmal anfordert und dann die lokale Kopie verwendet, anstatt dein Dashboard bei jedem Öffnen von einer erneuten Netzwerk-Runde abhängig zu machen.</p>
<ul>
  <li>Das hält auch eine große Anzahl an Lesezeichen performant.</li>
  <li>Es reduziert das Grundrauschen an Anfragen für Icons, die sich ohnehin selten ändern.</li>
  <li>Es hält deinen importierten oder synchronisierten Workspace visuell konsistent.</li>
</ul>
<blockquote>
  <p>Assets sind keine zusätzliche Dekoration. Sie sind fester Bestandteil deines Workspace.</p>
</blockquote>
<p>Favicons laufen nach 90 Tagen ab und werden bei Bedarf später aktualisiert. Wenn du ein Favicon im Assets-Modal löschst, ruft Speedtab es automatisch neu ab, sobald das Lesezeichen oder die Notiz es das nächste Mal benötigt.</p>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'primary',
    type: 'html',
    title: 'INBOX',
    content: `
<h2>INBOX (Eingangskorb)</h2>
<p> Mit dem Kontextmenü deines Browsers kannst du Inhalte von jeder beliebigen Webseite blitzschnell abfangen und direkt in Speedtab speichern, ohne deinen aktuellen Tab zu verlassen. </p>
<ul>
  <li><strong>Seite als Lesezeichen speichern:</strong> Sendet die URL des aktuellen Tabs als Typ „Lesezeichen“ direkt in deine Speedtab-INBOX.</li>
  <li><strong>Seite als Notiz speichern:</strong> Sammelt die URL, den Seitentitel und die Kurzbeschreibung (Meta-Description) der aktuellen Seite und legt sie als strukturierte „Notiz“ in der Inbox ab.</li>
  <li><strong>Auswahl als Notiz speichern:</strong> Markiere einfach einen Text auf einer Website – per Rechtsklick wandert das Zitat als Textbaustein direkt in deine INBOX.</li>
</ul>
<hr>
<h3>Der INBOX-Manager</h3>
<p> Sobald sich Elemente in deiner INBOX befinden, verarbeitet Speedtab die Daten im Hintergrund und stellt das Einsortieren so komfortabel wie möglich bereit. </p>
<ul>
  <li> <strong>Live-Status im Tab-Titel:</strong> Du musst Speedtab nicht einmal geöffnet haben, um zu sehen, ob deine Daten angekommen sind. Der Tab-Titel von Speedtab im Browser-Hintergrund aktualisiert sich live und zeigt dir den aktuellen Zähler an (z. B. <code>INBOX [3] - Speedtab</code>). </li>
  <li> <strong>Der INBOX-Button:</strong> In der oberen Menüleiste von Speedtab erscheint ein Button mit der Anzahl der ausstehenden Einträge. Ein Klick öffnet den Manager, in dem du Eintrag für Eintrag entscheidest, wo er landen soll. </li>
  <li> <strong>Intelligente Filterung:</strong> Beim Einsortieren wählst du einfach „Seite“ → „Modul“ → „Tab“. Speedtab zeigt dir dabei nur Module an, die auch zum Datentyp passen. Ein Lesezeichen kann also niemals versehentlich in einem Notiz- oder Feed-Modul landen. </li>
  <li> <strong>Notizen erweitern oder neu anlegen:</strong> Bei gesammelten Texten kannst du entscheiden, ob eine völlig neue Notiz erstellt oder der Text an eine bestehende Notiz **angehängt** werden soll. </li>
  <li> <strong>Verschlüsselungs-Schutz:</strong> Verschlüsselte Notizen werden in der Liste zwar angezeigt, sind aber aus Sicherheitsgründen gesperrt und können nicht über die INBOX erweitert werden. </li>
  <li> <strong>Feeds:</strong> Das direkte Hinzufügen von Feed-Quellen über die INBOX wird derzeit nicht unterstützt. </li>
</ul>
<blockquote>
  <p> <strong>Tipp:</strong> Nutze die INBOX beim Recherchieren als Zwischenablage. Behalte einfach den Speedtab-Tab im Augenwinkel, sammle im Hintergrund deine Quellen und sortiere sie am Ende des Tages mit wenigen Klicks in dein Dashboard ein. </p>
</blockquote>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'primary',
    type: 'code',
    title: 'HTML',
    content: `
<h2>Polieren einer Notiz</h2>
<p>Nutze einfaches HTML, um eine Notiz in einen echten Leitfaden zu verwandeln.</p>

<h2>Erlaubte Tags</h2>

<a>, <p>, <br>, <hr>, <span>, <del>, <ins>, <cite>, <div>
<strong>, <b>, <em>, <i>, <u>, <s>, <mark>, <small>, <sub>, <sup>
<h1>, <h2>, <h3>, <h4>, <h5>, <h6>
<hgroup>
<ul>, <ol>, <li>, <menu>
<dl>, <dt>, <dd>
<blockquote>, <pre>, <code>, <kbd>, <samp>
<picture>, <figure>
<details>, <summary>
<nav>, <aside>, <article>, <address>
<table>, <thead>, <tbody>, <tr>, <th>, <td>
<textarea>

<h2>Erlaubte Attribute</h2>

href, title, target, rel
class
colspan, rowspan
    `,
  },

  /**
   * Page: Main
   * Module: Notes
   * Tab: ❔
   */
  {
    page: 'Main',
    module: 'Notizen',
    tab: '❔',
    colorScheme: 'dark',
    type: 'html',
    title: 'Über Speedtab',
    content: `
<h2>Über Speedtab</h2>
<p> <strong>Speedtab</strong> begann als persönliches Experiment, inspiriert von Operas altem "Speed Dial"-Feature. Das Ziel war einfach: Ein neuer Tab sollte sich sofort wie ein nützlicher, vertrauter Ort anfühlen. </p>
<p> Die erste Version war eine Web-App. Dadurch war sie scheinbar überall verfügbar und bot ein direktes Gefühl von Synchronisation zwischen mehreren Geräten. Es bedeutete aber auch eine dauerhafte Server-Abhängigkeit, einen Online-Zwang und den vollen Wartungsaufwand eines kompletten Web-Application-Stacks. </p>
<blockquote>
  <p> Die Erweiterungs-Version behält die Grundidee bei, befreit das Projekt jedoch von der Server-Last. </p>
</blockquote>
<h3>Warum es die Erweiterung gibt</h3>
<ul>
  <li>Kein Server für die normale Nutzung erforderlich</li>
  <li>Local-First-Speicherung mit explizitem Export und Import</li>
  <li>Optionale WebDAV-Synchronisation statt einer aufgezwungenen Online-Infrastruktur</li>
  <li>Ein Layout-System, das auf echte, tägliche Workflows zugeschnitten ist – keine starren, generischen Kacheln</li>
</ul>
<hr>
<table>
  <thead>
    <tr> <th>Phase</th> <th>Kernkonzept</th> </tr>
  </thead>
  <tbody>
    <tr>
      <td>WebApp</td>
      <td>Immer online, von überall erreichbar, serverbasiert</td>
    </tr>
    <tr>
      <td>Erweiterung</td>
      <td>Local-first, schnellerer Start, weniger Infrastruktur, volle Kontrolle über die Privatsphäre</td>
    </tr>
    <tr>
      <td>Heute</td>
      <td>Flexible Module, schwebende Notizen, Widgets, Export/Import und optionales WebDAV-Backup</td>
    </tr>
  </tbody>
</table>
<p> <small> Speedtab verfolgt immer noch dasselbe Ziel wie die allererste Idee: Öffne einen neuen Tab und fühle dich sofort zu Hause. </small> </p>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: '❔',
    colorScheme: 'primary',
    type: 'html',
    title: 'FAQ',
    content: `
<h2>FAQ</h2>
<h3>Wo werden meine Daten gespeichert?</h3>
<p> Standardmäßig speichert Speedtab alle Workspace-Daten lokal in diesem Browser-Profil. </p>
<hr>
<h3>Wie verschiebe ich meinen Workspace auf einen anderen Browser?</h3>
<p> Nutze den <strong>Datenaustausch</strong> (Data Exchange), um eine lokale Backup-Datei zu exportieren, und importiere diese anschließend im anderen Browser. </p>
<hr>
<h3>Ist WebDAV dasselbe wie eine Live-Synchronisation (Merge-Sync)?</h3>
<p> Nein. Die WebDAV-Synchronisation nutzt explizite Push- und Pull-Aktionen. Ein Push ersetzt den aktuellen Stand auf dem Server vollständig durch deinen lokalen Workspace. </p>
<hr>
<h3>Kann ich unterschiedliche Layouts für Smartphone und Desktop nutzen?</h3>
<p> Das mobile Layout bricht bereits automatisch in eine einzelne Spalte um, wenn der Platz knapp wird. Finetuning-Optionen für rein lokale Layout-Unterschiede folgen eventuell später. </p>
<hr>
<h3>Kann ich Speedtab komplett zurücksetzen?</h3>
<p> Ja. Das Bereinigungs-Modal (Cleanup) enthält einen abgesicherten, vollständigen Datenbank-Reset für das aktuelle Browser-Profil. </p>
<hr>
<h3>Was ist der sicherste Workflow?</h3>
<ul>
  <li>Behalte immer einen lokalen Export als Backup.</li>
  <li>Nutze WebDAV als zusätzliche Backup-Ebene, wenn du einen Cloud-Speicher möchtest.</li>
  <li>Überprüfe die Remote-Inhalte auf dem Server, bevor du Daten hochlädst (Push) oder herunterlädst (Pull).</li>
</ul>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: '❔',
    colorScheme: 'light',
    type: 'links',
    title: 'Link-Sammlung',
    content: `
Speedtab
https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff
Speedtab Projekt
https://github.com/5ElementsDesign/Speedtab/
Nützliche Dienste
https://app.koofr.net/app/
[hr]
https://open-meteo.com/
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: '❔',
    colorScheme: 'primary',
    type: 'code',
    title: 'Code-Snippets',
    content: `
/* Beispiel für Theme-Token */
:root {
  --st-theme-text: rgb(255 255 255 / 0.92);
  --st-theme-module-bg: rgb(0 0 0 / 0.58);
  --st-widget-bg: var(--st-theme-module-bg);
}

/* Beispiel für Widget-Token */
.st-widget-card {
  background: var(--st-widget-bg);
  color: var(--st-widget-text);
}

/* Raster-Beispiel (Grid) */
.st-modules-grid {
  grid-template-columns: repeat(10, minmax(0, 1fr));
}
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: '❔',
    colorScheme: 'warning',
    type: 'text',
    title: 'Datensicherheit',
    content: `
Speedtab ist Local-First.

- Dein Workspace lebt ausschließlich im aktuellen Browser-Profil, es sei denn, du exportierst oder synchronisierst ihn explizit.
- Ein lokaler Export ist dein sicherstes, portables Backup.
- Die Nutzung von WebDAV ist vollkommen optional und erfolgt rein manuell.
- „In Cloud pushen“ (Push To Remote) ersetzt den Live-Export auf deinem Server durch deinen aktuellen, lokalen Workspace.
- „Aus Cloud laden“ (Pull From Remote) importiert den Remote-Workspace in deinen aktuellen Browser.

Wenn du dir unsicher bist:
- Erstelle zuerst einen lokalen Export.
- Überprüfe die Inhalte auf deinem Remote-Server.
- Entscheide erst dann, ob du Daten laden oder hochladen möchtest.
    `,
  },

  /**
   * Page: Work
   * Module: todo
   * Tab: ToDo
   */
  {
    page: 'Arbeit',
    module: 'todo',
    tab: 'ToDo',
    type: 'text',
    colorScheme: 'warning',
    title: 'Todo',
    content: `- Füge eine Aufgabe hinzu`,
  },
]

export default exampleWorkspaceDefinition
