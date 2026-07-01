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
    title: 'My first note',
    content: `Use the passphrase 'Secret' to unlock the secret`,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Start',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Secret',
    title: 'Secret',
    content: `Speedtab is awesome!`,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Start',
    type: 'html',
    colorScheme: 'primary',
    title: 'Welcome to Speedtab',
    content: `
<h2>Welcome to Speedtab</h2>
<p> Speedtab is a modular new-tab workspace for bookmarks, notes, feeds, assets, remote sync, and portable exports. </p>
<blockquote>
  <p> This note is an <strong>HTML note</strong>. You can use richer structure than plain text while still keeping everything inside Speedtab. </p>
</blockquote>
<figure class="st-note-html-favicon-row">
  {{asset:image:1}}
  {{asset:image:2}}
  {{asset:image:3}}
</figure>
<h3>Highlights</h3>
<table>
  <thead>
    <tr> <th>Feature</th> <th>What it does</th> </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Bookmarks</strong></td>
      <td>Tabbed collections, preview images, quicklinks, and favicon handling.</td>
    </tr>
    <tr>
      <td><strong>Notes</strong></td>
      <td>Text, code, links, encrypted notes, and now structured HTML notes.</td>
    </tr>
    <tr>
      <td><strong>Feeds</strong></td>
      <td>RSS and Atom reading with source management and local reading tools.</td>
    </tr>
    <tr>
      <td><strong>Remote Sync</strong></td>
      <td>WebDAV push and pull with compare states, archive snapshots, and repair checks.</td>
    </tr>
    <tr>
      <td><strong>Widgets</strong></td>
      <td>Global rail widgets like weather, independent from the normal module grid.</td>
    </tr>
  </tbody>
</table>
<h3>Good to know</h3>
<ul>
  <li>Local export and remote sync are separate concepts.</li>
  <li>Encrypted notes stay locked until a passphrase is entered.</li>
  <li>Open notes can float above the page like small app windows.</li>
  <li>HTML notes are sanitised before rendering.</li>
</ul>
<h3>Example layout content</h3>
<p> HTML notes work well for compact dashboards, onboarding cards, guides, changelogs, and small documentation blocks. </p>
<pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome Web Store&lt;/a&gt;</code></pre>
<p> <small>Useful link:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Speedtab on the Chrome Web Store </a> </p>
<hr>
<p> <strong>Tip:</strong> This note is meant as a starter template. Duplicate it, then replace sections with your own dashboard guide. </p>
    `,
  },

  /**
   * Page: Main
   * Module: Notes
   * Tab: Features
   */
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'secondary',
    type: 'html',
    title: 'Bookmarks',
    content: `
<h2>Bookmarks</h2>
<p>Speedtab bookmarks are organized inside modules and tabs, so one page can hold anything from a focused work setup to a mixed dashboard for tools, reading, and daily shortcuts.</p>
<ul>
  <li><strong>Regular bookmark tiles</strong> can show titles, descriptions, favicons, or custom preview images.</li>
  <li><strong>Quicklinks mode</strong> turns a bookmark tab into a compact launcher with fixed favicon tiles.</li>
  <li><strong>Custom favicons</strong> let you override the default icon when you want a cleaner visual system.</li>
  <li><strong>Open behavior</strong> can follow your global preference or be tailored per module.</li>
</ul>
<blockquote>
  <p>Use bookmark modules for structure, and quicklink modules for speed.</p>
</blockquote>
<p>You can also move content between tabs later, so reorganizing your setup does not mean rebuilding it.</p>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'secondary',
    type: 'html',
    title: 'Notes',
    content: `
<h2>Notes</h2>
<p>Notes are more than plain text. Speedtab lets you mix different note types so a page can work as a dashboard, scratchpad, mini knowledge base, or private reference space.</p>
<ul>
  <li><strong>Text notes</strong> are ideal for reminders, lists, and quick structured writing.</li>
  <li><strong>HTML notes</strong> can render richer layouts for guides, callouts, and styled information blocks.</li>
  <li><strong>Code notes</strong> support syntax highlighting for snippets and configuration references.</li>
  <li><strong>Encrypted notes</strong> lock sensitive content behind a passphrase.</li>
  <li><strong>Link notes</strong> let one note become a small curated resource stack.</li>
</ul>
<p>Open a note to float it above the page, resize it, or keep it around while you continue working elsewhere in Speedtab.</p>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'secondary',
    type: 'html',
    title: 'Feed reader',
    content: `
<h2>Feed Reader</h2>
<p>Feed modules turn Speedtab into a lightweight reading layer. You can group sources in tabs, follow updates directly from the new-tab page, and archive items you want to keep.</p>
<ul>
  <li><strong>RSS and Atom feeds</strong> can live beside bookmarks and notes on the same page.</li>
  <li><strong>Search inside feeds</strong> helps narrow large source lists quickly.</li>
  <li><strong>Archived items</strong> let you keep important entries after they disappear from the live feed.</li>
  <li><strong>Expanded reading mode</strong> gives feed modules more width when a source needs it.</li>
</ul>
<blockquote>
  <p>It is a focused feed reader built into your dashboard, not a separate app fighting for attention.</p>
</blockquote>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'warning',
    type: 'html',
    title: 'Weather widget',
    content: `
<h2>Weather Widget</h2>
<p>The widget rail lives outside the normal module grid and is meant for small always-available information blocks. The first widget is weather, with a compact layout that stays out of the way.</p>
<ul>
  <li><strong>Top or bottom rail</strong> placement, depending on the layout you prefer.</li>
  <li><strong>Left, center, or right</strong> rail alignment.</li>
  <li><strong>Configurable refresh interval</strong> and unit system.</li>
  <li><strong>Location search</strong> built into settings.</li>
</ul>
<p>If no location is set, the widget stays as a lightweight placeholder until you configure it.</p>
<hr>
<p><small>The widget system is designed to grow, so weather is only the beginning.</small></p>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'primary',
    type: 'html',
    title: 'Assets',
    content: `
<h2>Assets</h2>
<p>Speedtab keeps images and favicons with the rest of your workspace because they are part of how your dashboard actually looks and feels.</p>
<ul>
  <li><strong>Bookmark preview images</strong> are part of the layout work you already did. A customized dashboard should stay customized, not fall back forever after sync or import.</li>
  <li><strong>Favicons</strong> are fetched through an external service because that is the most reliable way to find them, but those requests still have to happen at least once.</li>
  <li><strong>Stored favicon assets</strong> prevent the same bookmarks from triggering huge amounts of repeated network requests whenever your dashboard loads.</li>
  <li><strong>Wallpapers and note images</strong> are obvious workspace content, so they travel with your pages, notes, and settings across devices.</li>
</ul>
<hr>
<h3>Why not fetch everything every time?</h3>
<p>Some sites have broken icons, local URLs, redirects, or temporary errors. Storing favicon assets locally means Speedtab can request them once, then keep using the local copy instead of making your dashboard depend on another fresh network roundtrip every time it opens.</p>
<ul>
  <li>That keeps high bookmark counts practical.</li>
  <li>It reduces request noise for icons that rarely change.</li>
  <li>It keeps your imported or synced workspace visually consistent.</li>
</ul>
<blockquote>
  <p>Assets are not extra decoration. They are part of your workspace.</p>
</blockquote>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'primary',
    type: 'html',
    title: 'INBOX',
    content: `
<h2>INBOX</h2>
<p>Using your browser's context menu, you can instantly capture content from any web page and send it straight to Speedtab without ever leaving your current tab.</p>
<ul>
  <li><strong>Save current page as bookmark:</strong> Sends the URL of the active tab directly into your Speedtab INBOX as a "bookmark" type.</li>
  <li><strong>Save current page as note:</strong> Collects the URL, page title, and meta description of the active tab and stores it as a structured "note" in your INBOX.</li>
  <li><strong>Save selection as note:</strong> Simply highlight any text on a website – a quick right-click sends the captured snippet straight to your INBOX as a text block.</li>
</ul>
<hr>
<h3>The INBOX Manager</h3>
<p>Once items are captured in your INBOX, Speedtab processes the data in the background and provides a seamless workflow to organize them.</p>
<ul>
  <li><strong>Live Status in Tab Title:</strong> You don't even need to switch over to Speedtab to know your data was successfully captured. The browser tab title of Speedtab updates live in the background, showing you the exact pending count (e.g., <code>INBOX [3] - Speedtab</code>).</li>
  <li><strong>The INBOX Button:</strong> A dedicated button showing the number of pending items will appear in Speedtab's top header. Clicking it opens a modal where you can review each item and decide where it belongs.</li>
  <li><strong>Smart Filtering:</strong> To file an item, simply select "Page" → "Module" → "Tabs". Speedtab only shows modules that match the specific data type, ensuring you never accidentally store a bookmark inside a note or feed module.</li>
  <li><strong>Append or Create New Notes:</strong> For captured text snippets, you can choose whether to generate a completely new note or **append** the text directly to an existing note of your choice.</li>
  <li><strong>Encryption Protection:</strong> Encrypted notes are visible within the selection list but are securely disabled and unavailable for appending data via the INBOX.</li>
  <li><strong>Feed Sources:</strong> Directly adding RSS or Atom feed sources via the INBOX context menu is currently not supported.</li>
</ul>
<blockquote>
  <p><strong>Tip:</strong> Use the INBOX as a frictionless scratchpad during intense research sessions. Just keep an eye on the Speedtab tab title in the background, collect your resources on the fly, and sort them into your workspace at the end of the day with just a few clicks.</p>
</blockquote>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: 'Features',
    colorScheme: 'primary',
    type: 'code',
    title: 'HTML',
    content: `
<!-- HTML notes can be simple and practical. -->

<h2>Polish a note</h2>
<p>Use simple HTML to turn a note into a guide.</p>

<!--
  Use HTML comments like this for your own descriptions or reminders.
-->

<h2>Allowed Tags</h2>

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

<h2>Allowed Attributes</h2>

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
    module: 'Notes',
    tab: '❔',
    colorScheme: 'dark',
    type: 'html',
    title: 'About Speedtab',
    content: `
<h2>About Speedtab</h2>
<p> <strong>Speedtab</strong> started as a personal experiment inspired by Opera's old Speed Dial experience. The goal was simple: open a new tab and land in a place that feels useful immediately. </p>
<p> The first version was a web app. That made it feel available everywhere and gave it a built-in multi-device sync feeling, but it also meant a permanent server dependency, online-first behavior, and the full weight of maintaining a web application stack. </p>
<blockquote>
  <p> The extension version keeps the idea, but removes the web-app burden. </p>
</blockquote>
<h3>Why the extension exists</h3>
<ul>
  <li>No server required for the normal experience</li>
  <li>Local-first storage with explicit export and import</li>
  <li>Optional WebDAV sync instead of mandatory online infrastructure</li>
  <li>A layout system shaped around real daily workflows, not generic tiles</li>
</ul>
<hr>
<table>
  <thead>
    <tr> <th>Phase</th> <th>Main idea</th> </tr>
  </thead>
  <tbody>
    <tr>
      <td>WebApp</td>
      <td>Always online, accessible anywhere, server-backed</td>
    </tr>
    <tr>
      <td>Extension</td>
      <td>Local-first, faster startup, less infrastructure, more privacy control</td>
    </tr>
    <tr>
      <td>Today</td>
      <td>Flexible modules, floating notes, widgets, export/import, and optional WebDAV backup</td>
    </tr>
  </tbody>
</table>
<p> <small> Speedtab still aims for the same feeling as the original idea: log in or open a new tab and feel at home immediately. </small> </p>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: '❔',
    colorScheme: 'primary',
    type: 'html',
    title: 'FAQ',
    content: `
<h2>FAQ</h2>
<h3>Where is my data stored?</h3>
<p> By default, Speedtab stores workspace data locally in this browser profile. </p>
<hr>
<h3>How do I move my workspace to another browser?</h3>
<p> Use <strong>Data Exchange</strong> to export a local backup file, then import it in another browser. </p>
<hr>
<h3>Is WebDAV the same as live merge sync?</h3>
<p> No. WebDAV sync uses explicit push and pull actions. A push replaces the live remote export with the local one. </p>
<hr>
<h3>Can I keep different layouts on phone and desktop?</h3>
<p> Mobile layout already collapses to a single column when space gets narrow. More local-only layout tuning may come later. </p>
<hr>
<h3>Can I reset Speedtab completely?</h3>
<p> Yes. The Cleanup modal includes a guarded full database reset for the current browser profile. </p>
<hr>
<h3>What is the safest workflow?</h3>
<ul>
  <li>Keep a local export</li>
  <li>Use WebDAV as an extra backup layer if you want remote storage</li>
  <li>Check remote contents before pulling or pushing</li>
</ul>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: '❔',
    colorScheme: 'light',
    type: 'links',
    title: 'Link Stack',
    content: `
Speedtab
https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff
[hr]
Speedtab Project
https://github.com/5ElementsDesign/Speedtab/
[hr]
Useful Services
https://app.koofr.net/app/
https://open-meteo.com/v
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: '❔',
    colorScheme: 'primary',
    type: 'code',
    title: 'Code Snippets',
    content: `
/* Theme token example */
:root {
  --st-theme-text: rgb(255 255 255 / 0.92);
  --st-theme-module-bg: rgb(0 0 0 / 0.58);
  --st-widget-bg: var(--st-theme-module-bg);
}

/* Widget token example */
.st-widget-card {
  background: var(--st-widget-bg);
  color: var(--st-widget-text);
}

/* Grid example */
.st-modules-grid {
  grid-template-columns: repeat(10, minmax(0, 1fr));
}
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
    tab: '❔',
    colorScheme: 'warning',
    type: 'text',
    title: 'Data Safety',
    content: `
Speedtab is local-first.

- Your workspace lives in the current browser profile unless you export or sync it.
- A local export is the safest portable backup.
- WebDAV is optional and explicit.
- "Push To Remote" replaces the live remote export with your local workspace.
- "Pull From Remote" imports the remote workspace into the current browser.

If you are unsure:
- Export first
- Check remote contents
- Then decide whether to pull or push
    `,
  },

  /**
   * Page: Work
   * Module: todo
   * Tab: ToDo
   */
  {
    page: 'Work',
    module: 'todo',
    tab: 'ToDo',
    type: 'text',
    colorScheme: 'warning',
    title: 'Todo',
    content: `
- Add your first task
- Add another task
    `,
  },
]

export default exampleWorkspaceDefinition
