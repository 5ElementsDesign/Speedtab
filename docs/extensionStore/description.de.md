Speedtab: Das ultra-schnelle, lokale Dashboard für deinen neuen Tab, das dich nicht trackt. Gebaut mit reinem Vanilla JS, ohne Frameworks und mit minimalem Speicherverbrauch.

Speedtab ersetzt die Standard-Startseite deines Browsers durch ein schnelles, dichtes und lokales Speed Dial & Produktivitäts-Dashboard. Kein Account. Kein Speedtab-Backend. Kein Tracking. Optionale Remote-Synchronisierung. Nur deine Daten, auf deine Art.

Erstelle maßgeschneiderte Startseiten für verschiedene Kontexte, unterteile sie in modulare Raster und organisiere deine Inhalte in Tabs. Kombiniere visuelle Lesezeichen, RSS/Atom-Feeds, Schnellnotizen, Code-Snippets, Linklisten, HTML-Komponenten und verschlüsselte private Notizen in einem ultra-schnellen, einheitlichen Workspace.

Speedtab ist auf Struktur, Geschwindigkeit und vollständige Datenkontrolle ausgelegt:

- kein Account erforderlich
- kein Speedtab-Backend
- kein Cloud-Konto erforderlich
- echtes Local-First-Speichern im Browser
- portabler Export/Import für volle Datensouveränität

Was du mit Speedtab tun kannst:

- Lesezeichen in Seiten, Modulen und benutzerdefinierten Tabs organisieren
- ein klassisches, leistungsstarkes Speed-Dial-Erlebnis genießen, das auf deine Workflows zugeschnitten ist
- lokale Vorschaubilder und eigene Favicons für deine Lesezeichen hochladen
- Text-, Code-, Link-, benutzerdefinierte HTML- und verschlüsselte Notizen erstellen
- unendliche, tief verschachtelte Tab-Strukturen in deinen HTML-Notizen erstellen (angetrieben durch YaiTabs)
- RSS/Atom-Feeds direkt auf deiner Startseite lesen
- Gelesen/Ungelesen-Status verfolgen und interessante Feed-Einträge mit Kommentaren archivieren
- das visuelle Theme, Raster-Layouts und CSS-Hintergründe anpassen
- deinen Workspace mit nahtlosem Export/Import zwischen Browserprofilen übertragen

Speedtab arbeitet vollständig lokal. Anwendungsdaten werden sicher in IndexedDB innerhalb deines Browserprofils gespeichert. Das Abrufen von Feeds erfolgt direkt über den Hintergrund-Service-Worker der Extension. Verschlüsselte Notizen werden clientseitig mit AES-GCM und PBKDF2-SHA256 geschützt. Deine Passphrasen verlassen niemals deinen Rechner.

Hole dir einen echten, leistungsstarken New-Tab-Workspace anstelle einer generischen Startseite oder eines datenschutzunfreundlichen Cloud-Dashboards.

----------------------------------------
UMFASSENDE SPEEDTAB FEATURE-ÜBERSICHT
----------------------------------------

APP SHELL & WORKSPACE-ARCHITEKTUR
• Bildschirmfüllende App Shell mit anpassbarer Mehrseiten-Navigation für Workspaces oder Kontext-Kategorien.
• Drag-and-Drop-Neuanordnung für Seiten, Module, Sammlungen und einzelne Einträge.
• Event-Delegation-Core angetrieben von YaiJS und YEH (Yai Event Hub), der auf einer einzigen gemeinsamen Laufzeitumgebung mit O(1)-Skalierung und ohne Virtual-DOM-Overhead läuft.
• Ultra-leichtgewichtiger Core mit einer reaktionsschnellen Benutzeroberfläche und ohne Virtual-DOM-Overhead.
• Vollständige Tastaturnavigation und WCAG 2.1 AA Barrierefreiheit (Pfeiltasten, Pos1, Ende, Eingabe, Leertaste).
• Globale, entprellte (debounced) Header-Suche mit Sofort-Lokalisiere-Funktion, absoluter Ergebnis-Ebene und In-Page-Hervorhebung.
• Erscheinungsbild und Layout-Steuerung:
  - Globales Standard-Wallpaper und seitenbezogene Hintergrund-Overrides.
  - Benutzerdefinierter CSS-Hintergrund-Editor mit Live-Syntaxprüfung und Archiv-Ablage für gespeicherte Verläufe/Farben.
  - Layout-Steuerung pro Modul: Auto, mehrspaltige Spannen (Col-Span) und Vollbreiten-Raster.
  - Modul-Mindesthöhen-Steuerung und Modul-spezifische Abstands-/Padding-Overrides.
  - Shell-Breitenbegrenzungen und flexible Placement-Optionen für die Widget-Leiste (oben oder unten).

VISUELLES LESEZEICHEN-MODUL
• Visuelles Kachel-Rendering mit Unterstützung für eigene Favicons oder hochgeladene Vorschaubilder.
• Integriertes Zuschneide-Tool (CropperJS), um lokale Vorschaubilder vor dem Speichern auf ein festes Kachelverhältnis zuzuschneiden.
• Asset-Browser und Favicon-Manager:
  - Wähle aus allen in IndexedDB gespeicherten Favicons.
  - Lade eigene Favicons direkt hoch.
  - Automatische Erkennung und Reparatur für kontrastarme/transparente dunkle Favicons (fügt vor dem Speichern einen sauberen Hintergrund hinzu).
• Navigationseinstellungen: Öffnungsverhalten pro Modul zwischen aktuellem Tab und neuen Hintergrund-/Vordergrund-Tabs umschalten.
• Layout- & Kachel-Personalisierung:
  - Standard-Modus (106x60px visuelle Vorschaukacheln).
  - Quicklinks-Modus (ultra-dichtes 48x48px Favicon-Raster).
  - Big Tiles-Modus (154x80px vergrößerte visuelle Vorschauen).
  - Optionaler Titel-unter-Kachel-Modus für etikettenbasiertes Scannen.
  - Kachelbezogene benutzerdefinierte Hintergrundfarben mit Transparenzunterstützung.

SPEED-DIAL-MODUL
• Dedizierte Speed-Dial-Fläche in voller Breite mit einer visuell minimalen, transparenten Modulhülle.
• Zentrierte 16:9-Kacheln mit einstellbarer Höhe und Inhaltsausrichtung oben, mittig oder unten.
• Optionale Tabs, eine Inline-Hinzufügen-Kachel und ein Ganzseiten-Höhenmodus für klassische oder kategorisierte Speed Dials.
• Eigene lokale Speed-Dial-Bildassets mit einstellbarem Bildabstand.
• Aus Favicon-Farben abgeleitete Kachelvisuals ohne externe Screenshot- oder Bilddienste.

NOTIZEN & INTERAKTIVE NOTE ENGINE
• Fünf Notiz-Inhaltstypen:
  - HTML-Notizen:
    * Bereinigtes (sanitized) HTML-Rendering mit asset-gestützten Platzhalter-Tokens und Inline-Bildern.
    * Hält live bedienbare, voll interaktive verschachtelte YaiTabs-Tab-Strukturen direkt im Notiz-Inhalt.
    * Attribute-Driven Style API (data-st-*-Attribute für Breite, Höhe, Margin, Padding, Flexbox, Grid, Rahmen, Radien, Schatten, Typografie und Farben) ohne Inline-Style-Sicherheitsrisiken.
    * Vordefinierte Makros zum schnellen Einfügen von Layout-Skeletten und Komponentenvorlagen.
  - Text-Notizen: Plain-Text-Editor für schnelle, unformatierte Notizen.
  - Link-Notizen: Wandelt zeilenweise URLs direkt in anklickbare Linklisten um; Textblöcke ohne URL werden als Zitatblöcke dargestellt.
  - Code-Notizen: Monospaced-Code-Speicher mit automatischer Syntax-Hervorhebung über Highlight.js.
  - Crypt-Notizen: Clientseitig verschlüsselte private Notizen mit AES-GCM und PBKDF2-SHA256 (310.000 Iterationen). Erfordert eine Passphrase zur Entschlüsselung; Passphrasen werden niemals gespeichert oder zwischengespeichert.
• Notiz-Editor-Modi:
  - Standard-Split-View-Editor mit zuschaltbarer Live-Vorschau für HTML-Notizen.
  - Flying Config: Bearbeite tief verschachtelte HTML-Notiz-Tab-Inhalte über eine dedizierte, fokussierte Konfigurationsoberfläche. Kein langes Suchen mehr in verschachtelten Tabs nach dem richtigen Inhalt.
  - Lokaler Quicknote-Spickzettel (Scratchpad): Über den Header erreichbares lokales Scratchpad, das unabhängig von Workspace-Exporten gespeichert wird.
• Schwebendes Fenstersystem (Floating Windows): Notizen können in ziehbare, skalierbare und stapelebenen-gesteuerte Fenster ausgekoppelt werden, die ihren Zustand, ihre Position und ihre Größe über Browser-Neustarts hinweg beibehalten.

FEED-READER-MODUL
• Integriertes RSS/Atom-Feed-Reader-Modul, das direkt in jedem Modulraster platziert werden kann.
• Feed-Quellen-Verwaltung: Hinzufügen, Validieren und lückenloses Erkennen (Auto-Discovery) von versteckten RSS/Atom-Feed-Endpunkten standardmäßiger Web-URLs.
• Reader-Funktionen:
  - Quellen-Filterung und anpassbare Limits für angezeigte Artikel.
  - Verfolgung des Gelesen-/Ungelesen-Status mit gesammelten Aktionen zum Markieren.
  - Artikel-Archiv-Manager zum lokalen Speichern von Artikeln mit optionalen Benutzerkommentaren.
  - Erweiterte Leseansicht (Expanded Reader View): Maximierung von Feed-Modulen in eine dedizierte Vollbreiten-Leseansicht mit anpassbaren Lesespalten-Breiten.
  - Lokales In-Feed-Textfilter-Eingabefeld zur Echtzeit-Suche geladener Artikel.
  - Optionale automatische Aktualisierungsschleife pro Modul, während der Tab aktiv ist.
  - Cross-Origin-Feed-Abrufe werden sicher durch den Hintergrund-Service-Worker ausgeführt.

WIDGET-LEISTE & UTILITY-TOOLS
• Modulare Widget-Leiste oberhalb oder unterhalb der Hauptseiten des Workspaces.
• Uhr- & Zeit-Utilities:
  - Umschaltbare digitale oder analoge Uhrzeitanzeige.
  - Lokalisierte Datums-/Uhrzeitformatierung, Token-Einfügehilfen, benutzerdefinierte Schriftgrößen, Ausrichtung und Elementfarben.
  - Lokale Stoppuhr- und Multi-Timer-Tools, die auf einer extrem effizienten Real-DOM-Renderschleife laufen.
• Wetter-System:
  - Kompakte Temperaturanzeige in der Leiste mit individueller Ortssuche und Einheiten-Umschaltung (Celsius/Fahrenheit).
  - Detailliertes wöchentliches Wettervorhersage-Modal direkt über die Leistenanzeige aufrufbar.
• Remote-Sync-Statusindikator mit visuellem Feedback zum Systemstatus.

KONTEXTMENÜ-ERFASSUNG & INBOX-ENGINE
• Kontextmenü-Integration des Browsers: Rechtsklick auf eine beliebige Webseite oder Textauswahl zum Ausführen von „Zu Quicknote hinzufügen“, ohne den aktiven Tab zu verlassen.
• Live-Zähler für ausstehende Elemente: Der Hintergrund-Tab-Titel aktualisiert sich dynamisch, um ungelesene Queue-Ablagen anzuzeigen (z. B. INBOX [3] - Speedtab).
• Erweiterter Inbox-Manager: Dedizierte Header-Schublade zum Überprüfen, Bearbeiten, Filtern und Einsortieren erfasster Clips in spezifische Lesezeichen- oder Notiz-Module.

DATENKONTROLLE, SPEICHERUNG & REMOTE-SYNC
• 100% Local-First-Speicherung: Der gesamte Anwendungsstatus, Modulstrukturen und Binärdateien werden in der clientseitigen IndexedDB über Dexie gespeichert.
• Portabler JSON-Datenaustausch:
  - Prüfsummenvalidierte JSON-Exportdateien (speedtab-export-<prüfsumme>.json).
  - Identitätsbewusste Record-Merge-Engine zur Übertragung von Workspaces zwischen Browserprofilen ohne Datensatzduplizierung.
  - Isolierte Import/Export-Dienstoberfläche (import-export.html).
• Optionale Remote-Cloud-Synchronisierung:
  - WebDAV-Sync: Manuelles Pushing, Pulling, Remote-Inhaltsvergleich und Statusprüfungen.
  - Google Drive Sync: OAuth-gestützter Sync über chrome.identity in den versteckten App-Data-Ordner des Benutzers, inklusive automatischer Intervall-Timer und Remote-Workspace-Gesundheitsprüfungen.

SYSTEMWARTUNG & GRID-SORTER
• Dedizierter Grid-Sorter (sorter.html): Isolierte Konfigurationsseite zum Reorganisieren von Workspace-Seitenhierarchien, Bearbeiten von Tab-Titeln inline und Ausführen kaskadierender Löschungen.
• System-Cleanup-Manager: Scanne lokale Datenbanktabellen, um verwaiste Datensätze, ungenutzte Binärdateien und veraltete Favicons aufzuspüren und zu bereinigen.

INTERNATIONALISIERUNG & NATIVE LOKALISIERUNG
• Extension-Internationalisierung aufgebaut auf nativem chrome.i18n.
• Vollständige UI-Übersetzungen und lokalisierte Beispiel-Workspaces für Deutsch, Englisch, Niederländisch, Türkisch, Hindi, Russisch und Chinesisch (vereinfacht).


----------------------------------------
PERFORMANCE & GRÖSSE
----------------------------------------

• Gezippte Extension-Größe: ~590 KB
• Chrome Task-Manager:
  - Speicher: ~50 MB Gesamtspeicher / ~5 MB aktiver JavaScript-Heap
  - CPU-Auslastung: 1-10% während aktiver Nutzung
  - ~40 Event-Listener insgesamt für die gesamte Extension
  - Reaktionsschnelle Benutzeroberfläche ohne Virtual-DOM-Overhead
