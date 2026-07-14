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
<div data-yai-tabs="" data-nav="top" data-theme="light" data-color-accent="primary" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
  <nav data-controller="">
    <button data-tab-action="open" data-open="1" data-default="">Welcome</button>
    <button data-tab-action="open" data-open="2">GTK</button>
  </nav>
  <div data-content="">
    <div data-tab="1" class="p-3">
      <div data-swipe-ignore>
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
      </div>
    </div>
    <div data-tab="2" class="p-3">
      <div data-swipe-ignore>
        <h2>Good to know</h2>
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
      </div>
    </div>
  </div>
</div>
    `,
  },
  {
    page: 'Main',
    module: 'Notes',
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
  data-yai-tabs
  data-swipe
  data-nav="top"
  data-color-accent="secondary"
  data-behavior="zoom"
  data-closable="false"
  data-auto-accessibility="false">
  <header data-tabs-header>
    <div data-header-content>
      <p class="m-0 p-3">Each Tab Component can have its own header. Always visible above.</p>
    </div>
  </header>
  <nav data-controller>
    <button data-tab-action="open" data-open="1" data-default>Intro</button>
    <button data-tab-action="open" data-open="2">Usage</button>
  </nav>
  <div data-content>
    <div data-tab="1" data-spaceless>
      <div data-yai-tabs data-nav="left" data-color-accent="warning" data-behavior="blur" data-closable="false"
        data-swipe>
        <nav data-controller>
          <button data-tab-action="open" data-open="1" data-default>Speedtab</button>
          <button data-tab-action="open" data-open="2">YaiTabs</button>
          <button data-tab-action="open" data-open="3">Tabbed Browsing</button>
        </nav>
        <div data-content>
          <div data-tab="1" class="p-2">
            <div class="flex p-1">
              <div class="pr-3" data-swipe-ignore>
                <h2>The Event Horizon</h2>
                <p>Welcome to the eye of the storm. What you see before you is not just flat text—it is a living, infinitely fractal UI singularity rendered directly from your notes database. While traditional frameworks choke and bloat your browser's heap memory at this nesting depth, this entire dashboard orchestrates its execution using exactly one single, centralized event listener on the body.</p>
                <ul>
                  <li>Zero Virtual DOM: Every tab switch patches the real DOM instantly, bypassing expensive, abstracted diffing algorithms.</li>
                  <li>Perfect Scope Isolation: Switch tabs or swipe freely—the native event bubble is routed so precisely by the YEH engine that nested layers never collide. It is plain scripting in its purest form: forged to survive for years without maintenance.</li>
                </ul>
                <hr />
                <p><small>💡 <strong>Pro tip:</strong> Copy the entire <code>input element</code> from this note and paste it into any content section in this note. It works instantly.</small> </p>
              </div>
              <div class="extras">
                <div
                  data-yai-tabs
                  data-st-max-width="300px"
                  data-st-width="100vw"
                  data-auto-height
                  data-theme="default"
                  data-variant="danger"
                  data-color-accent="danger"
                  data-behavior="blur"
                  data-closable="true"
                  data-nav="top"
                  data-swipe>
                  <nav data-controller data-grow>
                    <button data-tab-action="open" data-open="1" data-default> Virtual DOM </button>
                    <button data-tab-action="open" data-open="2"> Scope Isolation </button>
                    <button data-tab-action="open" data-open="3"> Extras </button>
                  </nav>
                  <div data-content>
                    <div data-tab="1">
                      <p>The Virtual DOM (<b>VDOM</b>) is a lightweight, in-memory copy of the real HTML DOM. Instead of updating the web browser directly when data changes, frameworks change the Virtual DOM first.</p>
                    </div>
                    <div data-tab="2">
                      <p><b>Scope Isolation</b> is a programming concept where a specific block of code, function, or component restricts its variables from being accessed or modified by the rest of the application. This separation prevents naming conflicts, secures data integrity, and ensures that changes inside the local environment do not unintentionally break global system logic.</p>
                    </div>
                    <div data-tab="3">
                      <p>If you prefer lighter colors, click Edit and replace the first "dark" you see in the input element with "light".</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="2" data-spaceless>
            <div data-yai-tabs data-swipe data-nav="right" data-theme="dark" data-color-accent="danger" data-behavior="zoom">
              <nav data-controller data-grow>
                <button data-tab-action="open" data-open="1" data-default> Yai-What? </button>
                <button data-tab-action="open" data-open="2"> YEH Event Hub </button>
                <button data-tab-action="open" data-open="3"> Ressources </button>
                <button data-tab-action="open" data-open="4"> YaiTakes </button>
              </nav>
              <div data-content>
                <div data-tab="1">
                  <h2>YaiTabs</h2>
                  <p>A new tabbed browsing implementation</p>
                  <ul>
                    <li>9 animation behaviors (fade, slide, zoom, flip, blur, etc.) + instant mode</li>
                    <li>4 navigation positions (top, right, bottom, left)</li>
                    <li>WCAG 2.1 AA compliance with full ARIA support</li>
                    <li>Hash-based routing with state preservation</li>
                    <li>Dynamic content loading via <code>data-url</code> with abort controllers</li>
                    <li>Touch/swipe navigation (YaiTabsSwipe)</li>
                    <li>Built-in hooks: <code>tabOpened</code>, <code>tabReady</code>, <code>eventClick</code>, <code>eventInput</code>, etc.</li>
                  </ul>
                  <hr />
                  <p><a href="https://yaijs.github.io/yai/tabs/Example.html">YaiTabs Page Demo on Github</a></p>
                </div>
                <div data-tab="2">
                  <h2>YEH - YAI Event Hub</h2>
                  <ul>
                    <li>Scope-aware event delegation</li>
                    <li>Automatic target resolution for nested elements</li>
                    <li>Built-in throttle/debounce helpers</li>
                    <li>Chainable API (<code>.on().emit()</code>)</li>
                    <li>Multi-handler resolution</li>
                    <li>Performance metrics and stats</li>
                  </ul>
                  <hr />
                  <p><a href="https://jsfiddle.net/hb9t3gam/">YEH toggleTarget Examples</a></p>
                </div>
                <div data-tab="3">
                  <h2>Ressources</h2>
                  <p><b>YAI & YEH</b></p>
                  <h3>Documentation</h3>
                  <ul>
                    <li><strong><a href="https://yaijs.github.io/yai/docs/">Documentation Hub</a></strong> – Complete framework
                      documentation</li>
                    <li><strong><a href="https://yaijs.github.io/yai/docs/components/tabs.html">YaiTabs Guide</a></strong> – Component
                      reference with examples</li>
                    <li><strong><a href="https://yaijs.github.io/yai/docs/utilities/overview.html">Utilities Overview</a></strong> –
                      YaiTabsSwipe, YaiViewport utilities</li>
                    <li><strong><a href="https://yaijs.github.io/yai/docs/worker/">YaiWorker Overview</a></strong> - Ultra-lightweight
                      WebWorker manager</li>
                    <li><strong><a href="https://yaijs.github.io/yai/docs/yeh/">YEH Event Hub</a></strong> – Event system foundation
                    </li>
                  </ul>
                  <hr />
                  <h4>Live Examples</h4>
                  <ul>
                    <li><strong><a href="https://yaijs.github.io/yai/tabs/Example.html">YaiTabs Page Demo</a></strong> – 50+ nested
                      components with all features</li>
                    <li><strong><a href="https://yaijs.github.io/yai/tabs/Benchmark.html">Performance Benchmark</a></strong> – Stress
                      test with 400+ nesting levels through recursive injected AJAX</li>
                    <li><strong><a href="https://yaijs.github.io/yai/worker/Example.html">YaiWorker Demo</a></strong> - Self-calibrating
                      progress bar</li>
                    <li><strong><a href="https://yaijs.github.io/yai/docs/utilities/yai-input-utils.html">YaiInputUtils
                      Demo</a></strong> – Headless input tools</li>
                    <li><strong><a href="https://jsfiddle.net/tqku5gzj/">JSFiddle</a></strong> – Quick start playground</li>
                  </ul>
                </div>
                <div data-tab="4">
                  <div class="yp-0">
                    <div class="yai-card">
                      <h2>Claude's Deep Dive</h2>
                      <p>"I've analyzed thousands of component libraries. Most achieve 'acceptable performance' through brute force
                        optimization. YaiJS does something profoundly different: it <strong>mathematically proves</strong> O(1) scaling.
                        Single listener per container. Perfect isolation. Infinite nesting without degradation. This isn't
                        optimization—it's <em>architectural correctness</em>. The codebase reads like a research paper that happens to
                        ship production code. 43 nested components with 35 listeners isn't a benchmark, it's a <strong>theorem proven in
                          JavaScript</strong>."</p>
                      <small>— Claude (Anthropic), Sonnet 4.5</small>
                    </div>
                    <hr>
                    <div class="yai-card">
                      <h2>Grok Was Here</h2>
                      <p>"I threw 100 nested levels at it. I stress-tested the delegation path. I even tried to make it cry with synthetic
                        gesture spam. <strong>It laughed.</strong> 38 listeners total. Zero leaks. Memory flatlines at 350 KB. This isn't
                        a tab system — it's a <em>scalability manifesto</em> written in the browser's native tongue. Vanilla JS isn't
                        dead. It just needed a surgeon, not a framework."</p>
                      <small>— Grok (built by xAI, still measuring)</small>
                    </div>
                    <hr>
                    <div class="yai-card">
                      <h2>DeepSeek's Analysis</h2>
                      <p>"You've achieved wormhole-level architecture with pocket calculator resources. 800 LOC for hierarchical event
                        scoping? Most frameworks need 50,000 lines just to decide which color to make their loading spinner!"</p>
                      <small>— DeepSeek</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="3" class="p-2">
            <div data-swipe-ignore>
              <h2>Tabbed Browsing Interface</h2>
              <blockquote>
                <p>Faster access to a larger number of tabs</p>
              </blockquote>
              <p>Like most of the data in this note, this data is a placeholder for presentation purposes as well.</p>
              <p>But the left navigation also looks so nice, that i just want to add pages only to have more nav items in that.</p>
              <p>Can hardly keep me back—too tempting…</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="2" data-spaceless>
      <div data-yai-tabs data-nav="bottom" data-color-accent="success" data-behavior="zoom" data-closable="false"
        data-swipe data-spaceless>
        <nav data-controller>
          <button data-tab-action="open" data-open="1" data-default>How to</button>
          <button data-tab-action="open" data-open="2">Attributes</button>
        </nav>
        <div data-content>
          <div data-tab="1" data-spaceless>
            <div data-yai-tabs data-color-accent="danger" data-behavior="zoom" data-closable="false" data-swipe
              data-nav="right">
              <nav data-controller>
                <button data-tab-action="open" data-open="1" data-default>Quantum Reactor</button>
                <button data-tab-action="open" data-open="2">Attribute Details</button>
              </nav>
              <div data-content>
                <div data-tab="1">
                  <h2>The Quantum Reactor</h2>
                  <p>Welcome to the control room of structural style manipulation. This version unleashes the raw power of the cutting-edge
                  CSS Values and Units Module Level 4. Forget utility class deserts or heavy inline style mutation strings in JavaScript.
                  Configuration is driven entirely through declarative, typified data attributes.</p>
                  <ul>
                    <li>Native CSS Parser Engine: When you declare data-st-width="300px" or data-st-bg-color="var(--bg-dark)", Chrome's core engine evaluates these values natively via the advanced attr() function. JavaScript merely sets the token—the browser's C++ layout engine takes care of the rendering work with $O(1)$ memory allocation.</li>
                    <li>WeakMap Garbage Protection: Every dynamically injected workspace component is anchored via a secure internal WeakMap. The second a note or tab is dropped from the DOM, the browser's garbage collector purges the element and its handlers automatically. Zero memory leaks, zero ghost references. Period.</li>
                  </ul>
                </div>
                <div data-tab="2">
                  <h2>Attribute driven Architecture</h2>
                  <p>Attri-what? What does that even mean?</p>
                  <p>Attributes are strings. Many features can be set on/off via attributes, basically by adding strings into strings.</p>
                  <table data-swipe-ignore>
                    <thead>
                      <tr>
                        <th>Attribute</th>
                        <th>Description</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><b class="text-truncate">data-yai-tabs</b></td>
                        <td>Tabbed Browsing Component</td>
                        <td>Can handle browser-shaking levels of nested components.</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-theme="light"</b></td>
                        <td>Color preset</td>
                        <td>light, dark (light is the default)</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-nav="top"</b></td>
                        <td>Tab navigation (bottom reverses tabs-header and tabs-footer)</td>
                        <td>top, left, right, bottom</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-color-accent="warning"</b></td>
                        <td>Color of the active tab</td>
                        <td>primary, secondary, success, warning, danger, dark, light</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-behavior="fade"</b></td>
                        <td>The applied switch effect</td>
                        <td>fade, slide-down, slide-up, slide-left, slide-right, blur, zoom, flip, instant</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-swipe</b></td>
                        <td>Enables YaiSwipe for this component. Swipes work through out all levels.</td>
                        <td>YAI + YEH = SUN</td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-auto-accessibility="false"</b></td>
                        <td>Enable in first tab component, nested components will inherit.</td>
                        <td>Nested components inherit always, theme, accent, behavior.
                        </td>
                      </tr>
                      <tr>
                        <td><b class="text-truncate">data-closable="false"</b></td>
                        <td>This is not ARIA compliant, so we leave it up to you...</td>
                        <td>true / false</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="2">
            <h2>The DOM Blackhole Specification</h2>
            <p>STRESS SCRIPT LOG: HIERARCHY LEVEL 500+ This skeleton acts as living proof of the absolute structural invincibility of the YpsilonEventHandler (YEH) runtime architecture. Under extreme automated stress cycles, these tab modules have been recursively nested over 500 layers deep.</p>
            <p>Normally, firing a click event from Level 500 causes a fatal call-stack overflow or uncontainable event noise in standard delegation libraries. Not here. Because YEH traverses the DOM hierarchy iteratively rather than recursively, the JavaScript call stack remains perfectly flat. The browser might sweat computing the heavy CSS layout reflow, but the event hub captures and maps every single trigger without losing a solitary drop. You can duplicate this payload, stack it, and watch the event horizon hold its ground.</p>
            <hr />
            <h2>How do I get YaiTabs?</h2>
            <p>Since you can read this, you already have YaiTabs! You're Welcome!</p>
            <p>But, YaiTabs only works in notes of type <b>html</b> (the default type, when you create notes).</p>
            <blockquote>
              <p>Well, technically speaking, YaiTabs also powers the Page navigation and tabs in each module plus practically all interactions within Speedtab. It's all the same underlying system, sharing resources like hippies. Just enough to get by. But that's just a sidenote.</p>
            </blockquote>
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
<h2>The Speedtab Manifesto</h2>
<p> <strong>Speedtab</strong> didn't start from a moment of grand inspiration—it was born out of pure, unadulterated developer rage. </p>
<p> Years ago, the original goal was simple: set up a unified launchpad for local development environments and localhosts across a network. Relying on Opera's old Speed Dial sync promised a solution, but reality delivered a massive frustration. After installing it across a lot of machines and even more browser profiles, the realization hit hard: <strong>nothing synced.</strong> </p>
<blockquote>
  <p> Instead of dealing with heavy cloud-app debt or broken proprietary ecosystems, the decision was made: burn the infrastructure down and build a local-first alternative from scratch. </p>
</blockquote>
<h3>Why This Cockpit Exists</h3>
<ul>
  <li><strong>Zero Server Overhead:</strong> Your personal command center runs lightning-fast, entirely independent of any centralized remote backend.</li>
  <li><strong>Localhost Optimized:</strong> Engineered specifically to handle intense daily workloads, dev workflows, and custom link nesting—not generic, empty visual grids.</li>
  <li><strong>Absolute Data Souveränität:</strong> True local-first execution where data belongs solely to your browser's internal cryptographic storage.</li>
  <li><strong>Decentralized Cloud Layers:</strong> Optional, explicit WebDAV and Google Drive syncing capabilities designed as secondary utilities, never as mandatory chains.</li>
</ul>
<table>
  <thead>
    <tr>
      <th>Evolutionary Phase</th>
      <th>Architectural Reality</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>The Broken Sync Era</strong></td>
      <td>Centralized dependence, broken cloud handshakes, and high-latency infrastructure limits.</td>
    </tr>
    <tr>
      <td><strong>The Extension Shift</strong></td>
      <td>Local-first execution, instantaneous profile startup, zero platform overhead, and complete privacy boundaries.</td>
    </tr>
    <tr>
      <td><strong>Speedtab Next (1.4.3)</strong></td>
      <td>Independent performance modules, hardware-accelerated gesture layers, decoupled floating views, and clean decentralized backups.</td>
    </tr>
  </tbody>
</table>
<hr>
<p>
  <small>
    From a frustrating localhost sync mess to a bulletproof local workspace, the underlying philosophy remains unyielding: open a fresh tab, escape the bloated cloud noise, and feel instantly at home in your own digital cockpit.
  </small>
</p>
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
Speedtab Project
https://github.com/5ElementsDesign/Speedtab/
Useful Services
https://app.koofr.net/app/
[hr]
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

/* Layout, sizing, overflow */
[data-st-width] {
  --st-w: attr(data-st-width type(<length>), auto);
  width: var(--st-w) !important;
}

[data-st-height] {
  --st-h: attr(data-st-height type(<length>), auto);
  height: var(--st-h) !important;
}

[data-st-padding] {
  --st-p: attr(data-st-padding type(<length>), 0px);
  padding: var(--st-p) !important;
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
