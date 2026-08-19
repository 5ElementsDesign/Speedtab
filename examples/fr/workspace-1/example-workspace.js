const exampleWorkspaceDefinition = [
  /**
   * Page: Principal
   * Module: Notes
   * Tab: Démarrage
   */
  {
    page: 'Principal',
    module: 'Notes',
    tab: 'Démarrage',
    type: 'text',
    colorScheme: 'success',
    title: 'Ma première note',
    content: `Utilisez la phrase secrète 'Secret' pour déverrouiller le secret`,
  },
  {
    page: 'Principal',
    module: 'Notes',
    tab: 'Démarrage',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Secret',
    title: 'Secret',
    content: `Speedtab est génial!`,
  },
  {
    page: 'Principal',
    module: 'Notes',
    tab: 'Démarrage',
    type: 'html',
    colorScheme: 'primary',
    title: 'Bienvenue sur Speedtab',
    content: `
<div data-yai-tabs="" data-nav="top" data-theme="light" data-color-accent="primary" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
  <nav data-controller="">
    <button data-tab-action="open" data-open="1" data-default="">Bienvenue</button>
    <button data-tab-action="open" data-open="2">À savoir</button>
  </nav>
  <div data-content="">
    <div data-tab="1" class="p-3">
      <div data-swipe-ignore>
        <h2>Bienvenue sur Speedtab</h2>
        <p> Speedtab est un espace de travail modulaire pour la page de nouvel onglet avec des favoris, des notes, des flux RSS, des ressources, une synchronisation distante et des exportations portables. </p>
        <blockquote>
          <p> Cette note est une <strong>note HTML</strong>. Vous pouvez utiliser une structure plus riche que le texte brut tout en gardant tout au sein de Speedtab. </p>
        </blockquote>
        <figure class="st-note-html-favicon-row">
          {{asset:image:1}}
          {{asset:image:2}}
          {{asset:image:3}}
        </figure>
        <h3>Points forts</h3>
        <table>
          <thead>
            <tr> <th>Fonctionnalité</th> <th>Ce qu'elle fait</th> </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Favoris</strong></td>
              <td>Collections avec onglets, images d'aperçu, liens rapides et gestion des favicons.</td>
            </tr>
            <tr>
              <td><strong>Notes</strong></td>
              <td>Texte, code, liens, notes chiffrées et notes HTML structurées.</td>
            </tr>
            <tr>
              <td><strong>Flux RSS</strong></td>
              <td>Lecture RSS & Atom avec gestion des sources et outils de lecture locaux.</td>
            </tr>
            <tr>
              <td><strong>Synchronisation distante</strong></td>
              <td>Envoi et obtention via WebDAV avec comparaison d'état, captures d'archives et vérifications de réparation.</td>
            </tr>
            <tr>
              <td><strong>Widgets</strong></td>
              <td>Widgets globaux dans la barre comme la météo, indépendants de la grille de modules classique.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div data-tab="2" class="p-3">
      <div data-swipe-ignore>
        <h2>À savoir</h2>
        <ul>
          <li>L'exportation locale et la synchronisation distante sont des concepts distincts.</li>
          <li>Les notes chiffrées restent verrouillées jusqu'à ce qu'une phrase secrète soit saisie.</li>
          <li>Les notes ouvertes peuvent flotter au-dessus de la page comme de petites fenêtres d'application.</li>
          <li>Les notes HTML sont nettoyées avant d'être rendues.</li>
        </ul>
        <h3>Exemple de contenu de mise en page</h3>
        <p> Les notes HTML fonctionnent très bien pour les tableaux de bord compacts, les cartes d'accueil, les guides, les journaux de modifications et les petits blocs de documentation. </p>
        <pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome Web Store&lt;/a&gt;</code></pre>
        <p> <small>Lien utile :</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Speedtab sur le Chrome Web Store </a> </p>
        <hr>
        <p> <strong>Conseil :</strong> Cette note est conçue comme un modèle de départ. Dupliquez-la, puis remplacez les sections par votre propre guide de tableau de bord. </p>
      </div>
    </div>
  </div>
</div>
    `,
  },
]

export default exampleWorkspaceDefinition