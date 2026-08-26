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
    content: `Nutze die Passphrase 'Mysteriös', um das Geheimnis zu entschlüsseln`,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Start',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Mysteriös',
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
          <p> Diese Notiz ist eine <b>HTML-Notiz</b>. Du kannst reichhaltigere Strukturen nutzen als bei reinem Text und trotzdem alles direkt in Speedtab behalten. </p>
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
              <td><b>Lesezeichen</b></td>
              <td>Tabbasierte Sammlungen, Vorschaubilder, Quicklinks und Favicon-Handling.</td>
            </tr>
            <tr>
              <td><b>Notizen</b></td>
              <td>Text, Code, Links, verschlüsselte Notizen und jetzt auch strukturierte HTML-Notizen.</td>
            </tr>
            <tr>
              <td><b>Feeds</b></td>
              <td>RSS- und Atom-Reader mit Quellenverwaltung und lokalen Lese-Tools.</td>
            </tr>
            <tr>
              <td><b>Remote Sync</b></td>
              <td>WebDAV-Push und -Pull mit Statusvergleich, Archiv-Snapshots und Reparatur-Prüfungen.</td>
            </tr>
            <tr>
              <td><b>Widgets</b></td>
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
        <p> <b>Tipp:</b> Diese Notiz ist als Starter-Vorlage gedacht. Dupliziere sie einfach und ersetze die Abschnitte durch deinen eigenen Dashboard-Leitfaden. </p>
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
    colorScheme: 'light',
    type: 'html',
    title: 'Wallspeed',
    meta: {
      window: {
        width: 1000,
        height: 740,
      },
    },
    content: `
<div data-yai-tabs="" data-theme="light" data-color-accent="dark" data-auto-accessibility="false">
  <nav data-controller="">
    <button
      data-tab-action="open" data-open="1" data-delay="100" data-min-loading="400" data-default
      data-url="https://5elementsdesign.github.io/Speedtab/ext/st/wallpaper/bg-color.html">Colors</button>
    <button
      data-tab-action="open" data-open="2" data-delay="100" data-min-loading="400"
      data-url="https://5elementsdesign.github.io/Speedtab/ext/st/wallpaper/list.html">Gallerie</button>
  </nav>
  <div data-content="" data-st-bg-color="#353535">
    <div data-tab="1" data-spaceless="" class="p-4 h-auto" data-st-bg-color="#353535"></div>
    <div data-tab="2" data-spaceless="" class="p-4 h-auto" data-st-bg-color="#353535"></div>
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
    meta: {
      window: {
        width: 1200,
        height: 740,
      },
    },
    content: `
<div
  data-theme="dark"
  data-yai-tabs=""
  data-nav="top"
  data-color-accent="secondary"
  data-behavior="zoom"
  data-swipe=""
  data-closable="false"
  data-auto-accessibility="false">
  <header data-tabs-header="">
    <div data-header-content="">
      <h1 data-st-margin="0" data-st-padding="14px" data-st-font-size="16px" data-st-font-weight="500"> <b>⚡ Speedtab Style-API-Demo</b> — 4 Ebenen verschachtelter Tabs mit data-st-*-Attributen </h1>
    </div>
  </header>
  <nav data-controller="">
    <button data-tab-action="open" data-open="overview" data-default=""><span data-st-margin-right="2px">📖</span> Übersicht</button>
    <button data-tab-action="open" data-open="architecture"><span data-st-margin-right="2px">🏗️</span> Architektur</button>
    <button data-tab-action="open" data-open="style-api"><span data-st-margin-right="2px">🎨</span> Style-API</button>
    <button data-tab-action="open" data-open="examples"><span data-st-margin-right="2px">💡</span> Beispiele</button>
  </nav>
  <div data-content="">
    <div data-tab="overview" data-spaceless="">
      <div data-yai-tabs="" data-nav="left" data-color-accent="warning" data-behavior="blur" data-closable="false" data-swipe="" data-spaceless="">
        <nav data-controller="">
          <button data-tab-action="open" data-open="what-is" data-default="">Was ist YaiTabs?</button>
          <button data-tab-action="open" data-open="key-features">Kernfunktionen</button>
          <button data-tab-action="open" data-open="use-cases">Einsatzbereiche</button>
        </nav>
        <div data-content="">
          <div data-tab="what-is" data-st-padding="16px" data-spaceless="">
            <div data-swipe-ignore="">
              <h2>Was ist YaiTabs?</h2>
              <p data-st-font-size="1.1rem"> Ein tab-basiertes Interface ohne Abhängigkeiten und mit beliebig tiefer Verschachtelung, aufgebaut auf <b>Event-Delegation</b> und <b>O(1)-Skalierung</b>.</p>
              <div data-st-grid="2" data-st-gap="16px" data-st-margin="1rem 0">
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px"> <span data-st-margin-right="2px">🎯</span> <span>Ohne Framework</span> </h3>
                  <p data-st-margin="0">Reines Vanilla-JS — kein React, kein Vue, kein virtueller DOM-Overhead. Nur der Browser, der das tut, was er am besten kann.</p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px"> <span data-st-margin-right="2px">♾️</span> <span>Unbegrenzte Verschachtelung</span> </h3>
                  <p data-st-margin="0">Du siehst gerade 4 verschachtelte Ebenen. Das System verarbeitet <b>500+</b>, ohne ins Schwitzen zu kommen. </p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px"> <span data-st-margin-right="2px">🧠</span> <span>Intelligente Events</span> </h3>
                  <p data-st-margin="0">Ein Listener pro Container. Keine Memory-Leaks. Jedes Mal saubere Garbage Collection.</p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px"> <span data-st-margin-right="2px">♿</span> <span>WCAG-konform</span> </h3>
                  <p data-st-margin="0">Vollständige ARIA-Unterstützung, Tastaturnavigation (Pfeiltasten, Home, Ende, Enter) und screenreaderfreundlich.</p>
                </div>
              </div>
              <hr>
              <div data-st-font-family="monospace">
                <p data-st-margin-bottom="0" data-st-font-size="0.9rem"><b>💡 Die Grundidee:</b> Statt jedem Tab-Button einen Listener zuzuweisen, verwendet YaiTabs <em>Event-Delegation</em> — ein Listener am Container fängt alle Events ab. Deshalb kosten 100 Tabs genauso viel wie 1.</p>
              </div>
            </div>
          </div>
          <div data-tab="key-features" data-st-padding="16px" data-spaceless="">
            <div data-st-display="flex" data-st-display-flex-safe data-st-gap="1rem">
              <div data-swipe-ignore>
                <h2>Kernfunktionen</h2>
                <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="18px">
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🎨</span>
                    <div>
                      <b>8 Animationsverhalten</b>
                      <p data-st-margin="0">Fade, Slide (4 Richtungen), Zoom, Blur, Flip, Sofort — vollständig CSS-gesteuert für 60-fps-Performance</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🧭</span>
                    <div>
                      <b>4 Navigationspositionen</b>
                      <p data-st-margin="0">Oben, unten, links, rechts — diese Demo verwendet <em>alle</em> auf unterschiedlichen Ebenen</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">👆</span>
                    <div>
                      <b>Touch- &amp; Swipe-Unterstützung</b>
                      <p data-st-margin="0">Funktioniert auf Mobilgeräten, Tablets und Touch-Laptops. Wischgesten funktionieren durch alle Verschachtelungsebenen.</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🔗</span>
                    <div>
                      <b>Hash-basiertes Routing</b>
                      <p data-st-margin="0">Jeder Tab erhält einen eindeutigen URL-Hash. Lesezeichen setzen, teilen oder für Deep-Links verwenden.</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🎯</span>
                    <div>
                      <b>Attributgesteuerte API</b>
                      <p data-st-margin="0">Alles mit data-*-Attributen deklarieren — für komplexe Interfaces ist kein JavaScript erforderlich.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="extras">
                <div data-yai-tabs data-st-max-width="300px" data-st-width="100vw" data-auto-height data-theme="default"
                  data-variant="danger" data-color-accent="danger" data-behavior="blur" data-closable="true"
                  data-nav="top" data-swipe>
                  <nav data-controller data-grow>
                    <button data-tab-action="open" data-open="1"> Virtueller DOM </button>
                    <button data-tab-action="open" data-open="2"> Bereichsisolation </button>
                    <button data-tab-action="open" data-open="3" data-default> Extras </button>
                  </nav>
                  <div data-content>
                    <div data-tab="1">
                      <p>Der virtuelle DOM (<b>VDOM</b>) ist eine schlanke In-Memory-Kopie des echten HTML-DOMs. Statt den Browser bei Datenänderungen direkt zu aktualisieren, ändern Frameworks zuerst den virtuellen DOM.</p>
                    </div>
                    <div data-tab="2">
                      <p><b>Bereichsisolation</b> ist ein Programmierkonzept, bei dem ein bestimmter Codeblock, eine Funktion oder Komponente den Zugriff und die Änderung seiner Variablen durch den Rest der Anwendung einschränkt. Diese Trennung verhindert Namenskonflikte, schützt die Datenintegrität und stellt sicher, dass Änderungen in der lokalen Umgebung nicht versehentlich die globale Systemlogik beschädigen.</p>
                    </div>
                    <div data-tab="3">
                      <p>Wenn du hellere Farben bevorzugst, klicke auf „Bearbeiten“ und ersetze das erste „dark“ im Eingabefeld durch „light“.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="use-cases" data-st-padding="16px" data-spaceless="">
            <div data-swipe-ignore="">
              <h2>Einsatzbereiche</h2>
              <div data-st-grid="2" data-st-gap="16px">
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px">
                  <h3 data-st-margin-top="0"><span data-st-margin-right="4px">📚</span> Dokumentationssysteme</h3>
                  <p data-st-margin="0">Erstelle verschachtelte Hilfecenter, API-Dokumentationen oder Benutzerhandbücher mit Abschnitten, Unterabschnitten und tiefer Navigation.</p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px">
                  <h3 data-st-margin-top="0"><span data-st-margin-right="4px">📊</span> Dashboard-Oberflächen</h3>
                  <p data-st-margin="0">Baue komplexe Admin-Panels, Analyse-Dashboards oder Daten-Explorer mit hierarchischer Organisation.</p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px">
                  <h3 data-st-margin-top="0"><span data-st-margin-right="4px">📝</span> Notiz-Apps</h3>
                  <p data-st-margin="0">Organisiere Notizen in verschachtelten Kategorien, erstelle Wiki-Wissensdatenbanken oder persönliche Wikis.</p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px">
                  <h3 data-st-margin-top="0"><span data-st-margin-right="4px">🎮</span> Interaktive Tutorials</h3>
                  <p data-st-margin="0">Erstelle Schritt-für-Schritt-Anleitungen, interaktive Demos oder Learning-by-doing-Erlebnisse mit progressiver Anzeige.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="architecture" data-spaceless="">
      <div data-yai-tabs="" data-nav="right" data-color-accent="danger" data-behavior="slide-up" data-swipe="" data-spaceless="">
        <nav data-controller="" data-grow="">
          <button data-tab-action="open" data-open="event-delegation" data-default="">Event-Delegation</button>
          <button data-tab-action="open" data-open="memory-model">Speichermodell</button>
          <button data-tab-action="open" data-open="performance-metrics">Performance-Metriken</button>
          <button data-tab-action="open" data-open="event-listener-counter">Inspector-Skript</button>
        </nav>
        <div data-content="" data-st-min-height="100%">
          <div data-tab="event-delegation" data-st-min-height="100%" data-st-padding="0" data-spaceless="">
            <div data-yai-tabs="" data-auto-height data-theme="light" data-nav="bottom" data-behavior="slide-down"
              data-swipe="" data-closable="false" data-auto-accessibility="false" data-color-accent="secondary"
              data-variant="success">
              <nav data-controller="">
                <button data-tab-action="open" data-open="1" data-default>Die Maschinenkammer</button>
                <button data-tab-action="open" data-open="2">Yaitails</button>
                <button data-tab-action="open"
                  data-open="3"
                  data-delay="200"
                  data-min-loading="400"
                  data-url-refresh
                  data-url="https://5elementsdesign.github.io/Speedtab/docs/data/dynamic.loading.test.html">Fetch Test</button>
              </nav>
              <div data-content="">
                <div data-tab="1" class="p-3">
                  <h2>Event-Horizont: Die Maschinenkammer</h2>
                  <div data-st-bg-color="rgba(255,255,255,0.03)" data-st-padding="0"
                    data-st-border-radius="8px" data-st-font-family="monospace" data-st-font-size="0.85rem"
                    data-st-margin="16px 0">
                    <pre data-swipe-ignore data-st-margin="0" data-st-white-space="pre-wrap"
                      data-st-word-break="break-all">// Instead of:
document.querySelectorAll('button').forEach(btn =&gt;
  btn.addEventListener('click', handler.bind(this)) // ❌ N listeners for N tab buttons
);
\n// YaiTabs does:
container.addEventListener('click', this) // ✅ 1 listener for infinite tab buttons</pre>
                  </div>
                  <div data-st-grid="1" data-st-flex-direction="column" data-st-gap="0">
                    <div data-st-display="flex" data-st-gap="12px" data-st-align-items="center"
                      data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px"
                      data-st-border-radius="6px">
                      <span data-st-font-size="1.2rem">🎯</span>
                      <div>
                        <b>Zentrale Kontrolle</b>
                        <p data-st-margin="0"> Ein Listener pro Container. 1.000 Tabs hinzufügen? Immer noch nur ein Listener. Die Kosten sind O(1), nicht O(n). </p>
                      </div>
                    </div>
                    <div data-st-display="flex" data-st-gap="12px" data-st-align-items="center"
                      data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px"
                      data-st-border-radius="6px">
                      <span data-st-font-size="1.2rem">🧩</span>
                      <div>
                        <b>Auflösung verschachtelter Bereiche</b>
                        <p data-st-margin="0">Events steigen nach oben auf. YEH stoppt am nächsten Controller.</p>
                      </div>
                    </div>
                    <div data-st-display="flex" data-st-gap="12px" data-st-align-items="center"
                      data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px"
                      data-st-border-radius="6px">
                      <span data-st-font-size="1.2rem">🔄</span>
                      <div>
                        <b>Iterative DOM-Durchquerung</b>
                        <p data-st-margin="0">YEH durchläuft das DOM iterativ statt rekursiv. Kein Call-Stack-Overflow — selbst bei mehr als 500 verschachtelten Ebenen.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-tab="2" class="p-3">
                  <div data-yai-tabs data-swipe data-nav="top" data-grow data-theme="dark" data-color-accent="light" data-variant="primary" data-behavior="flip">
                    <nav data-controller data-grow>
                      <button data-tab-action="open" data-open="1" data-default> Yai-What? </button>
                      <button data-tab-action="open" data-open="2"> YEH Event-Hub </button>
                      <button data-tab-action="open" data-open="3"> Ressourcen </button>
                    </nav>
                    <div data-content>
                      <div data-tab="1">
                        <h2>YaiTabs</h2>
                        <p>Eine neue Implementierung für Tab-Navigation</p>
                        <ul>
                          <li>9 Animationsverhalten (Fade, Slide, Zoom, Flip, Blur usw.) plus Sofort-Modus</li>
                          <li>4 Navigationspositionen (oben, rechts, unten, links)</li>
                          <li>WCAG-2.1-AA-Konformität mit vollständiger ARIA-Unterstützung</li>
                          <li>Hash-basiertes Routing mit Zustandsbewahrung</li>
                          <li>Dynamisches Laden von Inhalten über <code>data-url</code> mit Abort-Controllern</li>
                          <li>Touch-/Swipe-Navigation (YaiTabsSwipe)</li>
                          <li>Built-in hooks: <code>tabOpened</code>, <code>tabReady</code>, <code>eventClick</code>, <code>eventInput</code>, etc. </li>
                        </ul>
                        <hr />
                        <p><a href="https://yaijs.github.io/yai/tabs/Example.html">YaiTabs-Seitendemo auf GitHub</a></p>
                      </div>
                      <div data-tab="2">
                        <h2>YEH - YAI Event Hub</h2>
                        <p>Leichtgewichtige Event-Delegation-Bibliothek für moderne Webanwendungen</p>
                        <ul>
                          <li>Bereichsbewusste Event-Delegation</li>
                          <li>Automatische Zielauflösung für verschachtelte Elemente</li>
                          <li>Integrierte Throttle-/Debounce-Helfer</li>
                          <li>Chainable API (<code>.on().emit()</code>)</li>
                          <li>Auflösung mehrerer Handler</li>
                          <li>Performance-Metriken und Statistiken</li>
                        </ul>
                        <hr />
                        <p><a href="https://jsfiddle.net/hb9t3gam/">YEH-toggleTarget-Beispiele</a></p>
                      </div>
                      <div data-tab="3">
                        <h2>Ressourcen</h2>
                        <p><b>YAI & YEH</b></p>
                        <h3>Dokumentation</h3>
                        <ul>
                          <li><b><a href="https://yaijs.github.io/yai/docs/">Dokumentations-Hub</a></b> – Vollständige Framework-Dokumentation</li>
                          <li><b><a href="https://yaijs.github.io/yai/docs/components/tabs.html">YaiTabs Leitfaden</a></b> – Komponentenreferenz mit Beispielen</li>
                          <li><b><a href="https://yaijs.github.io/yai/docs/utilities/overview.html">Utilities Übersicht</a></b> – YaiTabsSwipe- und YaiViewport-Hilfsprogramme</li>
                          <li><b><a href="https://yaijs.github.io/yai/docs/worker/">YaiWorker-Übersicht</a></b> – Ultraleichtgewichtiger WebWorker-Manager</li>
                          <li><b><a href="https://yaijs.github.io/yai/docs/yeh/">YEH Event-Hub</a></b> – Grundlage des Event-Systems</li>
                        </ul>
                        <hr />
                        <h4>Live-Beispiele</h4>
                        <ul>
                          <li><b><a href="https://yaijs.github.io/yai/tabs/Example.html">YaiTabs Page Demo</a></b> – 50+ verschachtelte Komponenten mit allen Funktionen</li>
                          <li><b><a href="https://yaijs.github.io/yai/tabs/Benchmark.html">Performance Benchmark</a></b> – Stresstest mit mehr als 400 Verschachtelungsebenen durch rekursiv injiziertes AJAX</li>
                          <li><b><a href="https://yaijs.github.io/yai/worker/Example.html">YaiWorker Demo</a></b> – Selbstkalibrierender Fortschrittsbalken</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-tab="3" class="p-3"></div>
              </div>
            </div>
          </div>
          <div data-tab="memory-model" data-st-padding="16px" data-spaceless="">
              <h2>Speichermodell</h2>
            <div data-st-grid="2" data-st-gap="16px" data-st-margin="16px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">🧹 Saubere Garbage Collection</h3>
                <p data-st-margin="0">Wenn ein Tab entfernt wird, werden alle zugehörigen Event-Handler automatisch entfernt. Keine Geisterreferenzen. Keine Memory-Leaks.</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">📦 WeakMap-Verankerung</h3>
                <p data-st-margin="0">Jede Komponente wird über eine WeakMap verankert. Sobald das Element aus dem DOM entfernt wird, gibt die GC alles frei.</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">⚡ Konstanter Speicher</h3>
                <p data-st-margin="0">~350 KB Grundverbrauch. 100 Tabs hinzufügen? Immer noch ~350 KB. Das System skaliert horizontal, ohne mehr Speicher zu benötigen.</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">🎯 Kein Framework-Ballast</h3>
                <p data-st-margin="0">Keine externen Abhängigkeiten. Kein virtueller DOM. Keine schweren Bibliotheken. Nur der Browser und reines Vanilla-JS.</p>
              </div>
            </div>
          </div>
          <div data-tab="performance-metrics" data-st-padding="16px" data-spaceless="">
            <h2>Performance-Metriken</h2>
            <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="8px" data-st-margin="16px 0">
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="rgba(255,255,255,0.05)"
                data-st-border-radius="4px">
                <span>Tab-Wechsel (CSS-gesteuert)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">0 ms — 60 fps</span>
              </div>
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="rgba(255,255,255,0.05)"
                data-st-border-radius="4px">
                <span>Event-Verarbeitung (pro Klick)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">&lt; 0.5ms</span>
              </div>
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="rgba(255,255,255,0.05)"
                data-st-border-radius="4px">
                <span>Verschachtelte Tabs (500 Ebenen)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">Kein Stack-Overflow</span>
              </div>
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="rgba(255,255,255,0.05)"
                data-st-border-radius="4px">
                <span>Speicherbedarf (Basis)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">~350 KB</span>
              </div>
            </div>
            <hr>
            <div data-st-text-align="center" data-st-color="#aaa">
              <p data-st-margin="0"><b>⚡ Das Fazit:</b> „Wurmloch-Architektur mit Taschenrechner-Ressourcen.“ — DeepSeek</p>
            </div>
          </div>
          <div data-tab="event-listener-counter" data-st-padding="16px" data-spaceless="" data-swipe-ignore>
            <h2>🔍 Event-Listener-Inspektor</h2>
            <div data-st-bg-color="rgba(255,255,255,0.05)"
              data-st-padding="16px" data-st-border-radius="8px" data-st-margin="12px 0"
              data-st-border-left="4px solid var(--accent, #ff6b6b)">
              <p data-st-margin="0">
                <b>Schon einmal gefragt, wie viele Event-Listener eine Seite tatsächlich hat?</b>
                Jeder Klick-Handler, Scroll-Listener und jedes Tastaturkürzel summiert sich.
                Dieses Konsolenskript durchsucht das gesamte DOM und zeigt genau, was unter der Oberfläche passiert.
              </p>
            </div>
            <h3>Was es tut</h3>
            <ul data-st-margin="8px 0 16px 0" data-st-padding-left="20px">
              <li>Durchsucht <code>window</code>, <code>document</code> und jedes DOM-Element</li>
              <li>Zählt alle an jedes Element gebundenen Event-Listener</li>
              <li>Zeigt, welche Elemente die meisten Listener haben (Hotspots)</li>
              <li>Zeigt den durchschnittlichen Listener-Anteil pro Element</li>
            </ul>
            <h3>Warum das wichtig ist</h3>
            <ul data-st-margin="8px 0 16px 0" data-st-padding-left="20px">
              <li><b>Performance:</b> Zu viele Listener können deine Seite verlangsamen</li>
              <li><b>Memory-Leaks:</b> Verwaiste Listener verhindern Garbage Collection</li>
              <li><b>Debugging:</b> Finde heraus, welche Komponenten Event-Stürme verursachen</li>
              <li><b>Optimierung:</b> YaiTabs verwendet für die gesamte Speedtab-Erweiterung nur wenige gemeinsame Listener!</li>
            </ul>
            <hr>
            <h3>Verwendung</h3>
            <ol data-st-margin="8px 0 16px 0" data-st-padding-left="20px">
              <li>Öffne die Entwicklertools (F12 oder Cmd+Opt+I)</li>
              <li>Wechsle zum Tab <b>Konsole</b></li>
              <li>Kopiere das folgende Skript und füge es ein</li>
              <li>Rufe „Go Go Evento!“, drücke Enter und beobachte die Magie 🎤</li>
            </ol>
            <div data-st-bg-color="rgba(0,0,0,0.3)" data-st-padding="0" data-st-border-radius="4px" data-st-font-family="monospace" data-st-font-size="0.85rem" data-st-overflow="auto">
              <pre data-st-white-space="pre-wrap" data-st-margin="0" data-st-border-radius="4px" class="hljs"
>// 🔍 Event Listener Inspector - Fixed for SVG and weird class objects
// Paste this into your browser console (Chrome/Edge/Brave)
let t = 0,
  e = [];
[window, document, ...document.querySelectorAll("*")]
  .filter((el) => {
    const l = getEventListeners(el);
    return l && Object.keys(l).length > 0;
  })
  .forEach((el, i) => {
    const n =
      el === window
        ? "window"
        : el === document
          ? "document"
          : el.tagName.toLowerCase() +
          (el.id ? "#" + el.id : "") +
          (el.className && typeof el.className === "string"
            ? "." + el.className.split(" ").join(".")
            : el.className && el.className.baseVal
              ? "." + el.className.baseVal.split(" ").join(".")
              : ""),
      l = getEventListeners(el);
    let c = 0;
    Object.values(l).forEach((a) => (c += a.length));
    t += c;
    console.log(\`\${i + 1}. \${n}: \`);
    Object.entries(l).forEach(([ev, arr]) => console.log(\`  \${ev}: \${arr.length} \`));
    console.log(\`  Total: \${c} \`);
    e.push({ n, c });
  });
console.log(\`🎯 \${e.length} elements, \${t} listeners, avg \${(t / e.length).toFixed(2)} \`);
e.sort((a, b) => b.c - a.c)
  .slice(0, 5)
  .forEach((item, i) => console.log(\`\${i + 1}. \${item.n}: \${item.c}\`));</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="style-api" data-spaceless="">
      <div data-yai-tabs="" data-auto-height="" data-st-min-height="100%" data-nav="bottom" data-color-accent="success" data-behavior="zoom" data-swipe="">
        <nav data-controller="" data-grow="">
          <button data-tab-action="open" data-open="introduction" data-default="">Einführung</button>
          <button data-tab-action="open" data-open="layout">Layout</button>
          <button data-tab-action="open" data-open="flex-grid">Flex &amp; Grid</button>
          <button data-tab-action="open" data-open="visual">Visual</button>
          <button data-tab-action="open" data-open="live-demo">Live Demo</button>
        </nav>
        <div data-content="">
          <div data-tab="introduction" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Was ist die Style-API?</h2>
            <p><b>Deklaratives CSS, ohne CSS zu schreiben.</b> Verwende <code>data-st-*</code>-Attribute, um deine Notizen direkt in HTML zu gestalten. Der Browser erledigt den Rest.</p>
            <div data-st-grid="2" data-st-gap="16px" data-st-margin="20px 0">
              <div data-st-bg-color="rgba(255,255,255,0.03)" data-st-padding="16px" data-st-border-radius="8px">
                <h3 data-st-margin-top="0">✅ Was sie kann</h3>
                <ul data-st-margin="0" data-st-padding-left="20px">
                  <li>Wendet CSS über HTML-Attribute an</li>
                  <li>Funktioniert in Notizen und vertrauenswürdigen HTML-Bereichen</li>
                  <li>Verwendet <code>!important</code>, um App-Standardwerte zu überschreiben</li>
                  <li>Unterstützt Längen-, Prozent-, Farb-, Zahlen- und String-Werte</li>
                </ul>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.03)" data-st-padding="16px" data-st-border-radius="8px">
                <h3 data-st-margin-top="0">❌ Was sie nicht braucht</h3>
                <ul data-st-margin="0" data-st-padding-left="20px">
                  <li>Kein Inline-<code>style=""</code> erforderlich</li>
                  <li>Kein JavaScript zum Stylen erforderlich</li>
                  <li>Keine CSS-Klassenkämpfe</li>
                  <li>Keine frameworkspezifische Syntax</li>
                </ul>
              </div>
            </div>
            <h3>Kurzes Beispiel</h3>
            <div data-st-bg-color="rgba(0,0,0,0.3)" data-st-padding="16px" data-st-border-radius="8px" data-st-font-family="monospace" data-st-font-size="0.85rem">
              <pre data-swipe-ignore data-st-margin="0" data-st-white-space="pre-wrap">&lt;div data-st-width="300px"
      data-st-padding="16px"
      data-st-bg-color="var(--st-color-secondary)"
      data-st-border-radius="8px"&gt;
  Diese Karte wird mit data-st-*-Attributen gestaltet!
&lt;/div&gt;</pre>
            </div>
          </div>
          <div data-tab="layout" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Layout &amp; Sizing</h2>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="16px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-width</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set element width</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-height</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set element height</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-min-width</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set min-width</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-min-height</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set min-height</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-max-width</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set max-width</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-max-height</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set max-height</p>
              </div>
            </div>
            <h3>Margin &amp; Padding</h3>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-margin</code> <span data-st-font-size="0.8rem">(all sides)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-padding</code> <span data-st-font-size="0.8rem">(all sides)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-margin-top/bottom/left/right</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-padding-top/bottom/left/right</code>
              </div>
            </div>
            <h3>Border Controls</h3>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-border-radius</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-border</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-border-color</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-border-width</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-border-style</code>
              </div>
            </div>
          </div>
          <div data-tab="flex-grid" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Flex &amp; Grid Utilities</h2>
            <h3>Flex Properties</h3>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-flex</code> <span data-st-font-size="0.8rem">(flex: value)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-gap</code> <span data-st-font-size="0.8rem">(gap between items)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-flex-direction</code> <span data-st-font-size="0.8rem">(row, column)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-align-items</code> <span data-st-font-size="0.8rem">(center, stretch, etc.)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-justify-content</code> <span data-st-font-size="0.8rem">(start, center, end, etc.)</span>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-flex-wrap</code> <span data-st-font-size="0.8rem">(nowrap, wrap)</span>
              </div>
            </div>
            <h4>Typography</h4>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-font-size</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-font-weight</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-line-height</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-text-align</code>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-white-space</code>
              </div>
            </div>
          </div>
          <div data-tab="visual" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Visual &amp; Color Controls</h2>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="16px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-color</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Text color</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-bg-color</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Background color</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-opacity</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Opacity (0-1)</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-object-fit</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">For images</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-box-shadow-x</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Shadow X offset</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-box-shadow-y</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Shadow Y offset</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-box-shadow-blur</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Shadow blur radius</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-box-shadow-spread</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Shadow spread</p>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="12px" data-st-border-radius="6px">
                <code>data-st-box-shadow-type</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Shadow color</p>
              </div>
            </div>
            <div data-st-bg-color="rgba(255,255,255,0.03)" data-st-padding="16px" data-st-border-radius="8px" data-st-border-left="4px solid #22c55e">
              <b>💡 Pro Tip:</b> You can use CSS custom properties (variables) like <code>var(--st-color-accent)</code> or <code>var(--st-color-secondary)</code> as values!
            </div>
          </div>
          <div data-tab="live-demo" data-st-padding="20px" data-spaceless="">
            <div data-swipe-ignore>
              <h2>Live Demo: Style API in Action</h2>
              <div data-st-grid="3" data-st-gap="16px" data-st-margin="20px 0">
                <div data-st-bg-color="var(--accent, #ff6b6b)" data-st-padding="16px" data-st-border-radius="8px" data-st-display="flex" data-st-align-items="center" data-st-justify-content="center" data-st-min-height="80px">
                  <span data-st-color="#fff" data-st-font-weight="bold">Flex Centered</span>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-width="100%" data-st-max-width="200px">
                  <h3 data-st-margin-top="0">Max Width</h3>
                  <p data-st-margin="0" data-st-font-size="0.9rem">Limited to 200px</p>
                </div>
                <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px" data-st-font-size="1.2rem" data-st-text-align="center" data-st-line-height="1.8">
                  <p data-st-margin="0"><b>Big &amp; Centered</b></p>
                  <p data-st-margin="0" data-st-font-size="0.8rem">Using <code>data-st-font-size</code> &amp; <code>data-st-text-align</code></p>
                </div>
              </div>
              <hr>
              <div data-st-bg-color="rgba(0,0,0,0.3)" data-st-padding="16px" data-st-border-radius="8px" data-st-font-family="monospace" data-st-font-size="0.8rem" data-st-overflow="scroll">
                <pre data-swipe-ignore data-st-margin="0" data-st-white-space="pre-wrap">&lt;div data-st-grid="1" data-st-gap="16px"&gt;
  &lt;!-- Flex centered --&gt;
  &lt;div data-st-bg-color="var(--st-color-primary)"
      data-st-color="var(--st-color-primary-contrast)"
      data-st-padding="16px"
      data-st-border-radius="8px"
      data-st-display="flex"
      data-st-align-items="center"
      data-st-justify-content="center"
      data-st-min-height="120px"&gt;
    &lt;span data-st-font-weight="900"&gt;Flex Centered&lt;/span&gt;
  &lt;/div&gt;
&lt;/div&gt;</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="examples" data-spaceless="">
      <div data-yai-tabs="" data-auto-height data-st-min-height="100%" data-nav="right" data-color-accent="info" data-behavior="blur" data-closable="false" data-swipe="" data-spaceless="">
        <nav data-controller="" data-grow="">
          <button data-tab-action="open" data-open="card-grid" data-default="">Card Grid</button>
          <button data-tab-action="open" data-open="stats-dashboard">Stats Dashboard</button>
        </nav>
        <div data-content="" data-st-min-height="100%" data-swipe-ignore>
          <div data-tab="card-grid" data-st-padding="20px" data-spaceless="">
            <h2>Card Grid with Nested Tabs</h2>
            <div data-yai-tabs="" data-auto-height data-nav="left" data-color-accent="warning" data-behavior="fade" data-st-margin="16px 0" data-spaceless="">
              <nav data-controller="">
                <button data-tab-action="open" data-open="category-1" data-default="">Design</button>
                <button data-tab-action="open" data-open="category-2">Development</button>
                <button data-tab-action="open" data-open="category-3">Productivity</button>
              </nav>
              <div data-content="">
                <div data-tab="category-1" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="3" data-st-gap="12px">
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h3 data-st-margin-top="0">UI/UX Design</h3>
                      <p data-st-font-size="0.9rem">Interactive prototypes with YaiTabs</p>
                    </div>
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Design Systems</h4>
                      <p data-st-font-size="0.9rem">Reusable component libraries</p>
                    </div>
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">User Research</h4>
                      <p data-st-font-size="0.9rem">Findings &amp; insights documentation</p>
                    </div>
                  </div>
                </div>
                <div data-tab="category-2" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="3" data-st-gap="12px">
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px" data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Frontend</h4>
                      <p data-st-font-size="0.9rem">React, Vue, Svelte, Vanilla</p>
                    </div>
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Backend</h4>
                      <p data-st-font-size="0.9rem">Node, Python, Go, Rust</p>
                    </div>
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">DevOps</h4>
                      <p data-st-font-size="0.9rem">CI/CD, Docker, Kubernetes</p>
                    </div>
                  </div>
                </div>
                <div data-tab="category-3" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="3" data-st-gap="12px">
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Task Management</h4>
                      <p data-st-font-size="0.9rem">Kanban, GTD, Eisenhower</p>
                    </div>
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Knowledge Base</h4>
                      <p data-st-font-size="0.9rem">Personal wiki, Zettelkasten</p>
                    </div>
                    <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Goal Tracking</h4>
                      <p data-st-font-size="0.9rem">OKRs, habit tracking</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="stats-dashboard" data-st-padding="20px" data-spaceless="">
            <h2>Stats Dashboard</h2>
            <p>With some fake stats; Speedtab does not track anythng, so no stats</p>
            <div data-st-grid="4" data-st-gap="12px" data-st-margin="16px 0">
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="var(--accent, #ff6b6b)">247</div>
                <div data-st-font-size="0.85rem">Bookmarks</div>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="#4a9eff">42</div>
                <div data-st-font-size="0.85rem">Feed Sources</div>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="#22c55e">1,284</div>
                <div data-st-font-size="0.85rem">Notes</div>
              </div>
              <div data-st-bg-color="rgba(255,255,255,0.05)" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="#eab308">12</div>
                <div data-st-font-size="0.85rem">Workspaces</div>
              </div>
            </div>
            <div data-st-bg-color="rgba(255,255,255,0.03)" data-st-padding="16px" data-st-border-radius="8px" data-st-margin="16px 0">
              <h3 data-st-margin-top="0">Recent Activity</h3>
              <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="8px">
                <div data-st-display="flex" data-st-justify-content="space-between" data-st-padding="8px 0" data-st-border-bottom="1px solid rgba(255,255,255,0.05)">
                  <span>📝 Created new note: "Style API Reference"</span>
                  <span data-st-font-size="0.8rem">2 min ago</span>
                </div>
                <div data-st-display="flex" data-st-justify-content="space-between" data-st-padding="8px 0" data-st-border-bottom="1px solid rgba(255,255,255,0.05)">
                  <span>📡 Refreshed "Hacker News" feed</span>
                  <span data-st-font-size="0.8rem">15 min ago</span>
                </div>
                <div data-st-display="flex" data-st-justify-content="space-between" data-st-padding="8px 0">
                  <span>🔖 Bookmarked "YaiTabs Documentation"</span>
                  <span data-st-font-size="0.8rem">1 hour ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
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
    colorScheme: 'dark',
    type: 'html',
    title: 'Speedtab Kern',
    meta: {
      window: {
        height: 620,
      },
    },
    content: `
<div data-yai-tabs="" data-nav="top" data-theme="light" data-color-accent="dark" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
  <nav data-controller="">
    <button data-tab-action="open" data-open="1" data-default="">Lesezeichen</button>
    <button data-tab-action="open" data-open="2">Notizen</button>
    <button data-tab-action="open" data-open="3">Aufgaben (ToDo)</button>
    <button data-tab-action="open" data-open="4">Feed-Reader</button>
    <button data-tab-action="open" data-open="5">Mehr</button>
  </nav>
  <div data-content="">
    <div data-tab="1">
      <h2>Lesezeichen</h2>
      <p>Speedtab-Lesezeichen werden in Modulen und Tabs organisiert. So verwandelt sich eine statische Startseite in ein flexibles Dashboard für Arbeitsmittel, Recherche und tägliche Shortcuts.</p>
      <ul>
        <li><b>Visuelle Lesezeichen-Kacheln</b> zeigen klare Titel, Beschreibungen, Favicons oder hochauflösende Vorschau-Bilder.</li>
        <li><b>Speed Dial & Quicklinks-Modi</b> verwandeln Lesezeichen-Tabs in bildschirmfüllende visuelle Startseiten oder kompakte Icon-Raster.</li>
        <li><b>Eigene Favicons & Kachelfarben</b> bieten präzises visuelles Feintuning samt automatischer Farberkennung aus dem Favicon.</li>
        <li><b>Tab-übergreifendes Verschieben</b> erlaubt das einfache Umstrukturieren von Elementen zwischen Seiten und Modulen.</li>
      </ul>
      <blockquote><p>Nutze visuelle Module für Struktur, Quicklinks für maximale Dichte und Speed Dials für deine meistgenutzten Links.</p></blockquote>
      <hr />
      <nav class="pb-3"><button type="button" data-btn="dark" class="st-color-dark" data-click="openSorter">Inhalte sortieren</button></nav>
    </div>
    <div data-tab="2">
      <h2>Notizen</h2>
      <p>Notizen bieten modularen Freiraum. Mit Speedtab kannst du Fließtext, Code und verschachtelte Komponenten kombinieren – ideal als persönliches Wiki oder schneller Merkzettel.</p>
      <ul>
        <li><b>Text- & HTML-Notizen</b> unterstützen erweiterte Formatierungen, Info-Boxen und verschachtelte YaiTabs-Layouts.</li>
        <li><b>Code-Notizen</b> bieten Syntax-Highlighting für Snippets und Konfigurations-Referenzen.</li>
        <li><b>Verschlüsselte Notizen</b> sichern vertrauliche Inhalte lokal mit einem Passwort.</li>
        <li><b>Schwebende & PiP-Fenster</b> lösen Notizen als frei bewegliche Overlays oder native Bild-im-Bild-Fenster aus dem Dashboard.</li>
      </ul>
      <p>Über die obere Navigationsleiste steht außerdem eine globale <b>Quicknote</b> für schnelle Notizen zur Verfügung.</p>
      <blockquote><p><b>BTW:</b> Diese Notiz ist ein reales Beispiel für eine verschachtelte Tab-Komponente – auch wenn dieser Guide hier noch relativ flach ist im Vergleich zu dem, was möglich ist.</p></blockquote>
      <hr />
      <nav class="pb-3"><button type="button" data-btn="dark" class="st-color-dark" data-click="openQuicknote">Quicknote öffnen</button></nav>
    </div>
    <div data-tab="3">
      <h2>Aufgaben (ToDo)</h2>
      <p>Verbinde deine tägliche Aufgabenplanung direkt mit deinem Dashboard. Das ToDo-Modul kombiniert einfache Checklisten mit vollem Fristen-Management.</p>
      <ul>
        <li><b>Prioritäten & Farbcodierung</b> heben dringende Aufgaben durch visuelle Marker und Status-Signale hervor.</li>
        <li><b>Fälligkeiten & Zeitverfolgung</b> synchronisieren sich mit der zentralen App-Uhr für dynamische Status-Updates (Offen, Bald fällig, Überfällig).</li>
        <li><b>Notizen & Metadaten</b> halten Details, Links und Unterpunkte direkt an der jeweiligen Aufgabe fest.</li>
        <li><b>Kachel- & Listenansichten</b> wechseln nahtlos zwischen kompakten Zeilen und strukturierten Karten-Rastern.</li>
      </ul>
      <blockquote><p>Exportiere Aufgaben-Stapel unabhängig als kompakte Sammlungs-JSONs, um sie auf anderen Geräten zu nutzen.</p></blockquote>
    </div>
    <div data-tab="4">
      <h2>Feed-Reader</h2>
      <p>Feed-Module machen Speedtab zu einem ablenkungsfreien RSS-Reader, der deine Abonnements direkt neben deinen alltäglichen Tools bündelt.</p>
      <ul>
        <li><b>RSS- & Atom-Integration</b> organisiert Quellen in Tabs mit individuellen Auto-Refresh-Intervallen.</li>
        <li><b>Fokussierte & PiP-Leseansichten</b> öffnen Artikel in breiten Lese-Overlays oder schwebenden PiP-Fenstern.</li>
        <li><b>Echtzeit-Suche & Quellensuche</b> filtern ungelesene Artikel sofort oder finden Feed-Links direkt aus normalen Webseiten-URLs.</li>
        <li><b>Artikel-Archiv</b> speichert wichtige Beiträge lokal ab, selbst wenn sie aus dem Live-Feed herausfallen.</li>
      </ul>
      <blockquote><p>Ein fokussierter Feed-Reader direkt im Dashboard – ohne Algorithmen, ohne Ablenkung.</p></blockquote>
    </div>
    <div data-tab="5" data-st-bg-color="#c2c6ca88">
      <div data-yai-tabs="" data-nav="bottom" data-theme="light" data-color-accent="dark" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
        <nav data-controller="">
          <button data-tab-action="open" data-open="1" data-default="">Info</button>
          <button data-tab-action="open" data-open="2" data-delay="200" data-min-loading="300" data-url="https://5elementsdesign.github.io/Speedtab/PRIVACY.md">Datenschutz</button>
          <button data-tab-action="open" data-open="3" data-delay="200" data-min-loading="300" data-url="https://5elementsdesign.github.io/Speedtab/SECURITY.md">Sicherheit</button>
        </nav>
        <div data-content="">
          <div data-tab="1">
            <h3>Live-Dokumentation</h3>
            <p>Datenschutzrichtlinien und Sicherheits-Erklärungen werden bei Bedarf direkt aus unserem GitHub-Repository geladen:</p>
            <p><a target="_blank" rel="noopener noreferrer" href="https://5elementsdesign.github.io/Speedtab">5elementsdesign.github.io/Speedtab</a></p>
            <blockquote><p>Klicke unten auf <b>Datenschutz</b> oder <b>Sicherheit</b>, um die aktuellsten Richtlinien abzurufen.</p></blockquote>
          </div>
          <pre data-tab="2" data-st-margin="0" data-st-white-space="pre-wrap"></pre>
          <pre data-tab="3" data-st-margin="0" data-st-white-space="pre-wrap"></pre>
        </div>
      </div>
    </div>
  </div>
</div>
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
  <li><b>Platzierung in der oberen oder unteren Schiene</b>, je nachdem, welches Layout du für deinen Workflow bevorzugst.</li>
  <li><b>Linksbündige, zentrierte oder rechtsbündige</b> Ausrichtung in der Schiene.</li>
  <li><b>Einstellbares Aktualisierungsintervall</b> und frei wählbare Einheiten (Metrisch/Imperial).</li>
  <li><b>Standortsuche</b> direkt in den Einstellungen integriert, komplett ohne datenschutzunfreundliche Geolokalisierungs-Abfragen.</li>
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
  <li><b>Lesezeichen-Vorschaubilder</b> sind Teil deiner Layout-Arbeit. Ein angepasstes Dashboard sollte dauerhaft angepasst bleiben und nach einem Sync oder Import nicht wieder zurückgesetzt werden.</li>
  <li><b>Favicons</b> werden über einen externen Dienst geladen, da dies der zuverlässigste Weg ist, sie zu finden. Diese Anfragen müssen jedoch mindestens einmal stattfinden.</li>
  <li><b>Gespeicherte Favicon-Assets</b> verhindern, dass dieselben Lesezeichen bei jedem Laden deines Dashboards riesige Mengen wiederholter Netzwerkanfragen auslösen.</li>
  <li><b>Hintergrundbilder und Notiz-Bilder</b> sind offensichtlicher Workspace-Inhalt, sodass sie mit deinen Seiten, Notizen und Einstellungen über Geräte hinweg wandern.</li>
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
  <li><b>Seite als Lesezeichen speichern:</b> Sendet die URL des aktuellen Tabs als Typ „Lesezeichen“ direkt in deine Speedtab-INBOX.</li>
  <li><b>Seite als Notiz speichern:</b> Sammelt die URL, den Seitentitel und die Kurzbeschreibung (Meta-Description) der aktuellen Seite und legt sie als strukturierte „Notiz“ in der Inbox ab.</li>
  <li><b>Auswahl als Notiz speichern:</b> Markiere einfach einen Text auf einer Website – per Rechtsklick wandert das Zitat als Textbaustein direkt in deine INBOX.</li>
</ul>
<hr>
<h3>Der INBOX-Manager</h3>
<p> Sobald sich Elemente in deiner INBOX befinden, verarbeitet Speedtab die Daten im Hintergrund und stellt das Einsortieren so komfortabel wie möglich bereit. </p>
<ul>
  <li> <b>Live-Status im Tab-Titel:</b> Du musst Speedtab nicht einmal geöffnet haben, um zu sehen, ob deine Daten angekommen sind. Der Tab-Titel von Speedtab im Browser-Hintergrund aktualisiert sich live und zeigt dir den aktuellen Zähler an (z. B. <code>INBOX [3] - Speedtab</code>). </li>
  <li> <b>Der INBOX-Button:</b> In der oberen Menüleiste von Speedtab erscheint ein Button mit der Anzahl der ausstehenden Einträge. Ein Klick öffnet den Manager, in dem du Eintrag für Eintrag entscheidest, wo er landen soll. </li>
  <li> <b>Intelligente Filterung:</b> Beim Einsortieren wählst du einfach „Seite“ → „Modul“ → „Tab“. Speedtab zeigt dir dabei nur Module an, die auch zum Datentyp passen. Ein Lesezeichen kann also niemals versehentlich in einem Notiz- oder Feed-Modul landen. </li>
  <li> <b>Notizen erweitern oder neu anlegen:</b> Bei gesammelten Texten kannst du entscheiden, ob eine völlig neue Notiz erstellt oder der Text an eine bestehende Notiz **angehängt** werden soll. </li>
  <li> <b>Verschlüsselungs-Schutz:</b> Verschlüsselte Notizen werden in der Liste zwar angezeigt, sind aber aus Sicherheitsgründen gesperrt und können nicht über die INBOX erweitert werden. </li>
  <li> <b>Feeds:</b> Das direkte Hinzufügen von Feed-Quellen über die INBOX wird derzeit nicht unterstützt. </li>
</ul>
<blockquote>
  <p> <b>Tipp:</b> Nutze die INBOX beim Recherchieren als Zwischenablage. Behalte einfach den Speedtab-Tab im Augenwinkel, sammle im Hintergrund deine Quellen und sortiere sie am Ende des Tages mit wenigen Klicks in dein Dashboard ein. </p>
</blockquote>
    `,
  },
  {
    page: 'Main',
    module: 'Notizen',
    tab: 'Funktionen',
    colorScheme: 'secondary',
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
<p> <b>Speedtab</b> begann als persönliches Experiment, inspiriert von Operas altem "Speed Dial"-Feature. Das Ziel war einfach: Ein neuer Tab sollte sich sofort wie ein nützlicher, vertrauter Ort anfühlen. </p>
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
<p> Nutze den <b>Datenaustausch</b> (Data Exchange), um eine lokale Backup-Datei zu exportieren, und importiere diese anschließend im anderen Browser. </p>
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
    colorScheme: 'warning',
    type: 'text',
    title: 'Datensicherheit',
    content: `
Speedtab ist Local-First.
\n- Dein Workspace lebt ausschließlich im aktuellen Browser-Profil, es sei denn, du exportierst oder synchronisierst ihn explizit.
- Ein lokaler Export ist dein sicherstes, portables Backup.
- Die Nutzung von WebDAV ist vollkommen optional und erfolgt rein manuell.
- „In Cloud pushen“ (Push To Remote) ersetzt den Live-Export auf deinem Server durch deinen aktuellen, lokalen Workspace.
- „Aus Cloud laden“ (Pull From Remote) importiert den Remote-Workspace in deinen aktuellen Browser.
\nWenn du dir unsicher bist:
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
