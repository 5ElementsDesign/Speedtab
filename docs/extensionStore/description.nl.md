Speedtab: Het ultrasnelle, lokaal-eerst Nieuw-Tabblad werkruimte dat je niet volgt. Gebouwd met zuivere Vanilla JS, nul frameworks en een minimale geheugenvoetafdruk.

Speedtab vervangt de standaard Nieuw-Tabblad pagina van je browser door een snelle, compacte, lokaal-eerst Snelkiezer en productiviteitsdashboard. Geen account. Geen Speedtab-backend. Geen tracking. Optionele externe synchronisatie. Gewoon jouw gegevens, op jouw manier.

Bouw aangepaste startpagina's voor verschillende contexten, verdeel ze in modulaire roosters en organiseer je inhoud in tabbladen. Combineer visuele bladwijzers, RSS/Atom-feeds, snelle notities, codefragmenten, linklijsten, HTML-componenten en versleutelde privénotities in één ultrasnelle, universele werkruimte.

Speedtab is ontworpen voor structuur, snelheid en het volledige eigendom over je gegevens:

• geen account vereist
• geen Speedtab-backendservice
• geen cloudaccount vereist
• echte lokaal-eerst opslag in de browser
• overdraagbare export/import voor volledige gegevensvrijheid

Wat je kunt doen met Speedtab:

• organiseer bladwijzers in pagina's, modulen en aangepaste tabbladen
• geniet van een klassieke, hoogwaardige Snelkiezer-ervaring afgestemd op jouw werkwijzen
• upload lokale voorbeeldafbeeldingen en aangepaste favicons voor je bladwijzers
• beheer taken en to-do's met prioriteiten, vervaldatums, notities en visuele statusindicatoren
• maak tekst-, code-, link-, aangepaste HTML- en versleutelde notities
• bouw oneindige, diep geneste tabbladstructuren binnen je HTML-notities aangedreven door YaiTabs
• koppel notities en feedmodulen los in zwevende Document Picture-in-Picture (PiP) vensters
• lees RSS/Atom-feeds rechtstreeks op je startpagina met automatische vernieuwingsintervallen per tabblad
• houd de status van gelezen/ongelezen items bij en archiveer interessante feed-items met opmerkingen
• pas het visuele thema, de roosterindelingen en CSS-achtergronden aan
• exporteer en importeer volledige werkruimten of individuele bladwijzer-, notitie- en ToDo-verzamelingen via JSON

Speedtab is volledig lokaal-eerst. Toepassingsgegevens worden veilig opgeslagen in IndexedDB binnen je browserprofiel. Het ophalen van feeds wordt volledig door de extensie zelf afgehandeld via de achtergrond-serviceworker. Versleutelde notities worden aan de clientzijde beschermd met AES-GCM en PBKDF2-SHA256. Je wachtzinnen verlaten nooit je apparaat.

Krijg een echte, krachtige Nieuw-Tabblad werkruimte in plaats van een generieke startpagina of een privacyschendend clouddashboard.

----------------------------------------
UTGEBREID OVERZICHT VAN SPEEDTAB-FUNCTIES
----------------------------------------

APP SHELL & WERKRUIMTE-ARCHITECTUUR
• Beeldvullende App Shell met aanpasbare navigatie over meerdere pagina's voor werkruimten of contextcategorieën.
• Slepen-en-neerzetten sortering voor pagina's, modulen, verzamelingen en individuele items.
• Event-delegatie kern aangedreven door YaiJS en YEH (Yai Event Hub), werkend op een enkele gedeelde runtime met O(1) schaling en nul virtuele DOM-overhead.
• Ultralichte kern met een responsieve UI en nul virtuele DOM-overhead.
• Volledige toetsenbordnavigatie en WCAG 2.1 AA toegankelijkheidsondersteuning (Pijltjestoetsen, Home, End, Enter, Spatiebalk).
• Globale ontstoorde koptekstzoekfunctie met directe lokaliseerstroom, absolute resultatenlaag en markeringen op de pagina.
• Uiterlijk- en indelingselementen:
  - Globale standaardachtergrond en achtergrondoverschrijvingen per pagina.
  - Aangepaste CSS-achtergrondeditor met live syntaxisvalidatie en archiefplank voor opgeslagen verlopen/kleuren.
  - Indelingsbeheer per module: Auto, meerdere kolommen en volledige breedte roosterindelingen.
  - Minimale modulehoogte en instellingen voor inhoudsafstand/opvulling per module.
  - Shell-breedtegrenzen en plaatsing van de widgetbalk (boven of onder).

VISUELE BLADWIJZERS MODULE
• Visuele tegelrendering met ondersteuning voor aangepaste favicons of geüploade voorbeeldafbeeldingen.
• Ingebouwde bijsnijdtool (CropperJS) om lokale afbeeldingen bij te snijden naar een vaste tegelverhouding voor het opslaan.
• Bestandsbrowser en faviconbeheerder:
  - Selecteer uit alle favicons die zijn opgeslagen in IndexedDB-bestandstabellen.
  - Upload rechtstreeks aangepaste favicons.
  - Automatische detectie- en hersteltool voor donkere favicons met laag contrast/transparantie (voegt een schone achtergrondlaag toe voor het opslaan).
• Navigatie-instellingen: schakel het openingsgedrag per module tussen het huidige tabblad en nieuwe achtergrond-/voorgrondtabbladen.
• Indeling & Tegelaanpassing:
  - Standaardmodus (106x60px visuele voorbeeldtegels).
  - Snelkoppelingenmodus (zeer compact 48x48px favicon-eerst rooster).
  - Grote Tegels modus (154x80px vergrote visuele voorbeelden).
  - Optionele 'titel-onder-tegel' indelingsmodus voor het scannen van visuele bladwijzers op basis van labels.
  - Aangepaste achtergrondkleuren op tegelniveau met ondersteuning voor transparantie.

SNELKIEZER MODULE
• Dedicated Snelkiezer-oppervlak over de volle breedte met een visueel minimale, transparante moduleshell.
• Gecentreerde 16:9 tegels met aanpasbare hoogte en inhoudsuitlijning boven, midden of onder.
• Optionele tabbladen, inlijn tegel toevoegen en modus voor volledige paginahoogte voor klassieke of gecategoriseerde Snelkiezer-indelingen.
• Dedicated lokale Snelkiezer-afbeeldingsbestanden met opvulling per afbeelding.
• Van favicons afgeleide tegelkleuren creëren harmonieuze beelden zonder externe screenshot- of afbeeldingsservices.

TODO-MODULE
• Dedicated taakbeheermodule rechtstreeks geïntegreerd in het rooster van je werkruimte.
• Flexibele taakopties: prioriteiten, optionele kleurindicatoren, notities, vervaldatum/-tijd ondersteuning en compacte weergave van metagegevens.
• Duidelijke visuele statuslabels en kleurcodering voor openstaande, op tijd voltooide, te laat voltooide en verlopen taken.
• Tegelweergavemodus, standaard module-tabbladen en gedeelde snelinstellingen.

NOTITIES & INTERACTIEVE NOTITIE-ENGINE
• Vijf notitie-inhoudstypen:
  - HTML-notities:
    * Gezuiverde HTML-rendering met door bestanden ondersteunde tijdelijke aanduidingen en inlijn afbeeldingen.
    * Herbergt live, volledig interactieve YaiTabs geneste tabbladstructuren rechtstreeks binnen de notitie-inhoud.
    * Attribuutgestuurde Stijl-API (data-st-* attributen voor breedte, hoogte, marge, opvulling, flexbox, grid, randen, hoekronding, schaduwen, typografie en kleuren) zonder inlijn stijl-kwetsbaarheden.
    * Vooraf ingestelde macro's om skeletten en component-sjabloons in de editor in te voegen.
  - Tekstnotities: Eenvoudige tekstverwerker voor snelle ongeformatteerde notities.
  - Linknotities: Zet ruwe URL's regel voor regel direct om in aanklikbare linklijsten; tekstblokken zonder URL worden gerenderd als opgemaakte citaatblokken.
  - Codenotities: Codefragmenten opgeslagen in een lettertype met vaste breedte en automatische syntaxisaccentuering via Highlight.js.
  - Versleutelde notities: Aan de clientzijde versleutelde privénotities met AES-GCM en PBKDF2-SHA256 (310.000 iteraties). Vereist een wachtzin voor ontsleuteling; wachtzinnen worden nooit opgeslagen of gecacht.
• Notitie-editor modi:
  - Standaard gesplitste weergave-editor met in- en uitschakelbaar live voorbeeld voor HTML-notities.
  - Vliegende Configuratie: Bewerk diep geneste HTML-notitie tabblad-inhoud vanuit een dedicated, gefocust configuratie-oppervlak. Niet meer zoeken door geneste tabbladen om de juiste inhoud te vinden.
  - Lokale Snelle Notitie: Vanuit de koptekst toegankelijk lokaal kladblok dat onafhankelijk van werkruimte-exports wordt opgeslagen.
• Zwevend Venstersysteem & Picture-in-Picture: Notities kunnen worden losgekoppeld in sleepbare, in grootte aanpasbare vensters met focusvolgorde, of geopend in inheemse Document Picture-in-Picture (PiP) vensters met live inhoudssynchronisatie.

FEEDLEZER MODULE
• Geïntegreerde RSS/Atom-feedlezer module die rechtstreeks in elk paginamodulerooster kan worden geplaatst.
• Feedbronbeheer: voeg toe, valideer en ontdek automatisch verborgen RSS/Atom-feedeindpunten van standaard webdomein-URL's.
• Lezer-mogelijkheden:
  - Bronfiltering en aanpasbare limieten voor zichtbare artikelen.
  - Status van gelezen en ongelezen items bijhouden met acties voor bulk-markering.
  - Archiefbeheerder om artikelen lokaal op te slaan met optionele opmerkingen.
  - Uitgebreide lezersweergave: Vergroot feedmodulen tot een dedicated lesweergave over de volle breedte met aanpasbare leaskolombreedte.
  - Document Picture-in-Picture (PiP) ondersteuning: Koppel feedmodulen los in zwevende bureaubladvensters met behoud van scrollpositie en live inhoudsupdates.
  - Lokale tekstfilter binnen de feed om geladen artikelen in realtime te zoeken.
  - Automatische vernieuwing per feed-tabblad met configureerbare intervallen zolang het tabblad geopend is.
  - Cross-origin ophalen van feeds veilig uitgevoerd door de achtergrond-serviceworker.

WIDGETBALK & HULPMIDDELEN
• Modulaire widgetbalk geplaatst boven of onder de hoofdwerkruimtepagina's.
• Klok & Tijd Hulpmiddelen:
  - Gedeelde centrale App Clock-planner die gesynchroniseerde klokweergaven en taaktimers aanstuurt.
  - In- en uitschakelbare Digitale of Analoge klokweergave modi.
  - Gelokaliseerde datum/tijdnotatie, hulp middelen voor het invoegen van tekens, aangepaste lettergrootte, uitlijning en elementkleuren per onderdeel.
  - Lokaal-eerst Stopwatch en Multi-Timer hulpmiddelen die draaien op een realtime DOM-lus zonder prestatieverlies.
• Weersysteem:
  - Compacte temperatuuraflezing op de balk met aangepaste locatiezaak en eenhedenschakelaar (Celsius/Fahrenheit).
  - Gedetailleerde wekelijkse weersverwachting rechtstreeks toegankelijk vanaf de balk.
• Status-indicator voor externe synchronisatie met visuele statusfeedback.

CONTEXTMENU VASTLEGGEN & POSTVAK IN-ENGINE
• Browser Contextmenu Integratie: Klik met de rechtermuisknop op een webpagina of tekstselectie om "Toevoegen aan snelle notitie" uit te voeren zonder van tabblad te wisselen.
• Live Wachtrij-teller: Titels van achtergrondtabbladen worden dynamisch bijgewerkt om onverwerkte aantallen weer te geven (bijv. INBOX [3] - Speedtab).
• Geavanceerde Postvak IN Beheerder: Dedicated lade in de koptekst om vastgelegde fragmenten te beoordelen, te bewerken, te filteren en in specifieke bladwijzer- of notitiemodulen op te slaan.

EIGENDOM VAN GEGEVENS, OPSLAG & EXTERNE SYNCHRONISATIE
• 100% Lokaal-eerst Opslag: Alle toepassingsstatussen, modulestructuren en binaire bestanden worden opgeslagen in IndexedDB aan de clientzijde via Dexie.
• Overdraagbare JSON Gegevensuitwisseling:
  - Met controlesom geverifieerde JSON-exportbestanden (speedtab-export-<controlesom>.json).
  - Compacte JSON-verzameling import en export voor visuele bladwijzers, notities en ToDo-tabbladen.
  - Identiteitsbewuste samenvoeg-engine om werkruimten tussen browserprofielen over te dragen zonder duplicaten.
  - Geïsoleerde import/export hulppagina (import-export.html).
• Optionele Externe Cloudsynchronisatie:
  - WebDAV Synchronisatie: Handmatig verzenden, ophalen, externe inhoud vergelijken en statuscontroles.
  - Google Drive Synchronisatie: Met OAuth ondersteunde synchronisatie via chrome.identity naar de verborgen appdata-map van de gebruiker, inclusief automatische verzendintervallen en verificatie van de externe werkruimtestatus.

SYSTEEMONDERHOUD & ROOSTER SORTEERDER
• Dedicated Rooster Sorteerder (sorter.html): Geïsoleerde configuratiepagina om pagina-hiërarchieën te reorganiseren, tabbladtitels inlijn te bewerken en items definitief te verwijderen.
• Systeem Schoonmaakbeheerder: Scan lokale databasetabellen om achtergebleven gegevens, ongebruikte binaire bestanden en verouderde favicons te detecteren en te wissen.

INTERNATIONALISERING & INHEMSE LOKALISATIE
• Extensie-internationalisering gebouwd op inheemse chrome.i18n.
• Volledige UI-vertalingen en gelokaliseerde voorbeeldwerkruimten voor Engels, Duits, Nederlands, Turks, Hindi, Russisch en Chinees (vereenvoudigd).


----------------------------------------
PRESTATIES & GROOTTE
----------------------------------------

• Ingepakt extensieformaat (.ZIP): ~710 KB
• Chrome Taakbeheer
  - Geheugen: ~50 MB totaal geheugen / ~5 MB live JavaScript-heap
  - CPU-gebruik: 1-10% tijdens actief gebruik
  - ~40 totale event listeners voor de gehele extensie
  - Responsieve UI met nul virtuele DOM-overhead
  