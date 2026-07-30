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
  data-yai-tabs=""
  data-nav="top"
  data-color-accent="secondary"
  data-behavior="zoom"
  data-swipe=""
  data-closable="false"
  data-auto-accessibility="false">
  <header data-tabs-header="">
    <div data-header-content="">
      <h1 data-st-margin="0" data-st-padding="14px" data-st-font-size="16px" data-st-font-weight="500">
        <strong>⚡ Speedtab Style API Demo</strong> — 4 levels of nested tabs showcasing data-st-* attributes</h1>
    </div>
  </header>
  <nav data-controller="">
    <button data-tab-action="open" data-open="overview" data-default=""><span data-st-margin-right="2px">📖</span> Overview</button>
    <button data-tab-action="open" data-open="architecture"><span data-st-margin-right="2px">🏗️</span> Architecture</button>
    <button data-tab-action="open" data-open="style-api"><span data-st-margin-right="2px">🎨</span> Style API</button>
    <button data-tab-action="open" data-open="examples"><span data-st-margin-right="2px">💡</span> Examples</button>
  </nav>
  <div data-content="">
    <div data-tab="overview" data-spaceless="">
      <div data-yai-tabs="" data-nav="left" data-color-accent="warning" data-behavior="blur" data-closable="false"
        data-swipe="" data-spaceless="">
        <nav data-controller="">
          <button data-tab-action="open" data-open="what-is" data-default="">What is YaiTabs?</button>
          <button data-tab-action="open" data-open="key-features">Key Features</button>
          <button data-tab-action="open" data-open="use-cases">Use Cases</button>
        </nav>
        <div data-content="">
          <div data-tab="what-is" data-st-padding="16px" data-spaceless="">
            <div data-swipe-ignore="">
              <h2>What is YaiTabs?</h2>
              <p data-st-font-size="1.1rem">
                A zero-dependency, infinitely nestable tabbed interface system built on <strong>event
                delegation</strong> and <strong>O(1) scaling</strong>.</p>
              <div data-st-grid="2" data-st-gap="16px" data-st-margin="1rem 0">
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px">
                    <span>🎯</span> <span>Zero Framework</span>
                  </h3>
                  <p data-st-margin="0">Pure Vanilla JS — no React, no Vue, no virtual DOM overhead. Just the browser
                    doing what it does best.</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px">
                    <span>♾️</span> <span>Infinite Nesting</span>
                  </h3>
                  <p data-st-margin="0">You're currently looking at 4 nested levels. The system handles
                    <strong>500+</strong> without breaking a sweat.</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px">
                    <span>🧠</span> <span>Smart Eventing</span>
                  </h3>
                  <p data-st-margin="0">Single listener per container. Zero memory leaks. Clean GC every time.</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px" data-st-border-left="3px solid var(--accent, #ff6b6b)">
                  <h3 data-st-margin-top="0" data-st-display="flex" data-st-align-items="center" data-st-gap="8px">
                    <span>♿</span> <span>WCAG Compliant</span>
                  </h3>
                  <p data-st-margin="0">Full ARIA support, keyboard navigation (Arrow keys, Home, End, Enter), and
                    screen reader friendly.</p>
                </div>
              </div>
              <hr>
              <div data-st-font-family="monospace">
                <p data-st-margin-bottom="0" data-st-font-size="0.9rem"><strong>💡 The core idea:</strong> Instead of attaching listeners to every tab button, YaiTabs uses
                  <em>event delegation</em> — one listener on the container catches all events. This is why 100 tabs cost the same as 1.</p>
              </div>
            </div>
          </div>
          <div data-tab="key-features" data-st-padding="16px" data-spaceless="">
            <div data-st-display="flex" data-st-display-flex-safe data-st-gap="1rem">
              <div data-swipe-ignore>
                <h2>Key Features</h2>
                <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="18px">
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🎨</span>
                    <div>
                      <strong>8 Animation Behaviors</strong>
                      <p data-st-margin="0">fade, slide (4 directions), zoom,
                        blur, flip, instant — all CSS-driven for 60fps performance</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🧭</span>
                    <div>
                      <strong>4 Navigation Positions</strong>
                      <p data-st-margin="0">top, bottom, left, right — and
                        this demo uses <em>all of them</em> across different levels</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">👆</span>
                    <div>
                      <strong>Touch &amp; Swipe Support</strong>
                      <p data-st-margin="0">Works on mobile, tablets, and
                        touch-enabled laptops. Swipe gestures work through all nesting levels.</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🔗</span>
                    <div>
                      <strong>Hash-based Routing</strong>
                      <p data-st-margin="0">Each tab gets a unique URL hash.
                        Bookmark your state, share it, or use it for deep linking.</p>
                    </div>
                  </div>
                  <div data-st-display="flex" data-st-align-items="center" data-st-gap="18px">
                    <span data-st-font-size="1.5rem">🎯</span>
                    <div>
                      <strong>Attribute-Driven API</strong>
                      <p data-st-margin="0">Declare everything with data-*
                        attributes — no JavaScript required to build complex interfaces.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="extras">
                <div data-yai-tabs data-st-max-width="300px" data-st-width="100vw" data-auto-height data-theme="default"
                  data-variant="danger" data-color-accent="danger" data-behavior="blur" data-closable="true" data-nav="top"
                  data-swipe>
                  <nav data-controller data-grow>
                    <button data-tab-action="open" data-open="1" data-default> Virtual DOM </button>
                    <button data-tab-action="open" data-open="2"> Scope Isolation </button>
                    <button data-tab-action="open" data-open="3"> Extras </button>
                  </nav>
                  <div data-content>
                    <div data-tab="1">
                      <p>The Virtual DOM (<b>VDOM</b>) is a lightweight, in-memory copy of the real HTML DOM. Instead of updating
                        the web browser directly when data changes, frameworks change the Virtual DOM first.</p>
                    </div>
                    <div data-tab="2">
                      <p><b>Scope Isolation</b> is a programming concept where a specific block of code, function, or component
                        restricts its variables from being accessed or modified by the rest of the application. This separation
                        prevents naming conflicts, secures data integrity, and ensures that changes inside the local environment
                        do not unintentionally break global system logic.</p>
                    </div>
                    <div data-tab="3">
                      <p>If you prefer lighter colors, click Edit and replace the first "dark" you see in the input element with
                        "light".</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="use-cases" data-st-padding="16px" data-spaceless="">
            <div data-swipe-ignore="">
              <h2>Use Cases</h2>
              <div data-st-grid="2" data-st-gap="16px">
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px">
                  <h3 data-st-margin-top="0">📚 Documentation Systems</h3>
                  <p data-st-margin="0">Create nested help centers, API docs, or user guides with sections, subsections,
                    and deep navigation.</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px">
                  <h3 data-st-margin-top="0">📊 Dashboard Interfaces</h3>
                  <p data-st-margin="0">Build complex admin panels, analytics dashboards, or data explorers with
                    hierarchical organization.</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px">
                  <h3 data-st-margin-top="0">📝 Note-taking Apps</h3>
                  <p data-st-margin="0">Organize notes into nested categories, create wiki-style knowledge bases, or
                    build personal wikis.</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px">
                  <h3 data-st-margin-top="0">🎮 Interactive Tutorials</h3>
                  <p data-st-margin="0">Build step-by-step guides, interactive demos, or learn-by-doing experiences with
                    progressive disclosure.</p>
                </div>
              </div>
              <hr>
              <div data-st-text-align="center" data-st-font-style="italic">
                "This isn't optimization — it's architectural correctness." — Claude (Anthropic)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="architecture" data-spaceless="">
      <div data-yai-tabs="" data-nav="right" data-color-accent="danger" data-behavior="slide-up" data-swipe=""
        data-spaceless="">
        <nav data-controller="" data-grow="">
          <button data-tab-action="open" data-open="event-delegation" data-default="">Event Delegation</button>
          <button data-tab-action="open" data-open="memory-model">Memory Model</button>
          <button data-tab-action="open" data-open="performance-metrics">Performance Metrics</button>
          <button data-tab-action="open" data-open="event-listener-counter">Inspector Script</button>
        </nav>
        <div data-content="" data-st-min-height="100%">
          <div data-tab="event-delegation" data-st-min-height="100%" data-st-padding="0" data-spaceless="">
            <div data-yai-tabs=""
                data-auto-height
                data-theme="light"
                data-nav="bottom"
                data-behavior="slide-down"
                data-swipe=""
                data-closable="false"
                data-auto-accessibility="false"
                data-color-accent="secondary"
                data-variant="success">
              <nav data-controller="">
                <button data-tab-action="open" data-open="1" data-default>The Engine Room</button>
                <button data-tab-action="open" data-open="2">Yaitails</button>
              </nav>
              <div data-content="">
                <div data-tab="1" class="p-3">
                  <h2>Event Horizon: The Engine Room</h2>
                  <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.03))" data-st-padding="0" data-st-border-radius="8px"
                    data-st-font-family="monospace" data-st-font-size="0.85rem" data-st-margin="16px 0">
<pre data-swipe-ignore data-st-margin="0" data-st-white-space="pre-wrap" data-st-word-break="break-all"
>// Instead of:
document.querySelectorAll('button').forEach(btn =&gt;
  btn.addEventListener('click', handler.bind(this)) // ❌ N listeners for N tab buttons
);

// YaiTabs does:
container.addEventListener('click', this) // ✅ 1 listener for infinite tab buttons</pre>
                  </div>
                  <div data-st-grid="1" data-st-flex-direction="column" data-st-gap="0">
                    <div data-st-display="flex" data-st-gap="12px" data-st-align-items="center"
                      data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px" data-st-border-radius="6px">
                      <span data-st-font-size="1.2rem">🎯</span>
                      <div>
                        <strong>Single Point of Control</strong>
                        <p data-st-margin="0">
                          One listener per container. Add 1,000 tabs? Still one listener. The cost is O(1), not O(n).</p>
                      </div>
                    </div>
                    <div data-st-display="flex" data-st-gap="12px" data-st-align-items="center"
                      data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px" data-st-border-radius="6px">
                      <span data-st-font-size="1.2rem">🧩</span>
                      <div>
                        <strong>Nested Scope Resolution</strong>
                        <p data-st-margin="0">
                          Events bubble up. YEH stops at the nearest controller.</p>
                      </div>
                    </div>
                    <div data-st-display="flex" data-st-gap="12px" data-st-align-items="center"
                      data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px" data-st-border-radius="6px">
                      <span data-st-font-size="1.2rem">🔄</span>
                      <div>
                        <strong>Iterative DOM Traversal</strong>
                        <p data-st-margin="0">
                          YEH walks the DOM iteratively, not recursively. No call stack overflow — even at 500+ nested levels.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-tab="2" class="p-3">
                  <div data-yai-tabs
                    data-swipe
                    data-nav="top"
                    data-grow
                    data-theme="dark"
                    data-color-accent="light"
                    data-variant="primary"
                    data-behavior="flip">
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
                          <li>Built-in hooks: <code>tabOpened</code>, <code>tabReady</code>, <code>eventClick</code>,
                            <code>eventInput</code>, etc.
                          </li>
                        </ul>
                        <hr />
                        <p><a href="https://yaijs.github.io/yai/tabs/Example.html">YaiTabs Page Demo on Github</a></p>
                      </div>
                      <div data-tab="2">
                        <h2>YEH - YAI Event Hub</h2>
                        <p>Lightweight event delegation library for modern web applications</p>
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
                          <li><strong><a href="https://yaijs.github.io/yai/docs/">Documentation Hub</a></strong> – Complete
                            framework documentation</li>
                          <li><strong><a href="https://yaijs.github.io/yai/docs/components/tabs.html">YaiTabs
                            Guide</a></strong> – Component reference with examples</li>
                          <li><strong><a href="https://yaijs.github.io/yai/docs/utilities/overview.html">Utilities
                            Overview</a></strong> – YaiTabsSwipe, YaiViewport utilities</li>
                          <li><strong><a href="https://yaijs.github.io/yai/docs/worker/">YaiWorker Overview</a></strong> -
                            Ultra-lightweight WebWorker manager</li>
                          <li><strong><a href="https://yaijs.github.io/yai/docs/yeh/">YEH Event Hub</a></strong> – Event
                            system foundation</li>
                        </ul>
                        <hr />
                        <h4>Live Examples</h4>
                        <ul>
                          <li><strong><a href="https://yaijs.github.io/yai/tabs/Example.html">YaiTabs Page Demo</a></strong> –
                            50+ nested components with all features</li>
                          <li><strong><a href="https://yaijs.github.io/yai/tabs/Benchmark.html">Performance
                            Benchmark</a></strong> – Stress test with 400+ nesting levels through recursive injected AJAX</li>
                          <li><strong><a href="https://yaijs.github.io/yai/worker/Example.html">YaiWorker Demo</a></strong> -
                            Self-calibrating progress bar</li>
                        </ul>
                      </div>
                      <div data-tab="4">
                        <div class="yp-0">
                          <div class="yai-card">
                            <h2>Claude's Deep Dive</h2>
                            <p>"I've analyzed thousands of component libraries. Most achieve 'acceptable performance' through
                              brute force optimization. YaiJS does something profoundly different: it <strong>mathematically
                              proves</strong> O(1) scaling. Single listener per container. Perfect isolation. Infinite
                              nesting without degradation. This isn't optimization—it's <em>architectural correctness</em>.
                              The codebase reads like a research paper that happens to ship production code. 43 nested components
                              with 35 listeners isn't a benchmark, it's a <strong>theorem proven in JavaScript</strong>."</p>
                            <small>— Claude (Anthropic), Sonnet 4.5</small>
                          </div>
                          <hr>
                          <div class="yai-card">
                            <h2>Grok Was Here</h2>
                            <p>"I threw 100 nested levels at it. I stress-tested the delegation path. I even tried to make it
                              cry with synthetic gesture spam. <strong>It laughed.</strong> 38 listeners total. Zero leaks. Memory
                              flatlines at 350 KB. This isn't a tab system — it's a <em>scalability manifesto</em> written in the
                              browser's native tongue. Vanilla JS isn't dead. It just needed a surgeon, not a framework."</p>
                            <small>— Grok (built by xAI, still measuring)</small>
                          </div>
                          <hr>
                          <div class="yai-card">
                            <h2>DeepSeek's Analysis</h2>
                            <p>"You've achieved wormhole-level architecture with pocket calculator resources. 800 LOC for
                              hierarchical event scoping? Most frameworks need 50,000 lines just to decide which color to
                              make their loading spinner!"</p>
                            <small>— DeepSeek</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="memory-model" data-st-padding="16px" data-spaceless="">
            <h2>Memory Model</h2>
            <div data-st-grid="2" data-st-gap="16px" data-st-margin="16px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">🧹 Clean Garbage Collection</h3>
                <p data-st-margin="0">When a tab is removed, all its event handlers are purged automatically. No ghost
                  references. No memory leaks.</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">📦 WeakMap Anchoring</h3>
                <p data-st-margin="0">Every component is anchored via WeakMap. The moment the element is dropped from
                  the DOM, the GC reclaims everything.</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">⚡ Flatline Memory</h3>
                <p data-st-margin="0">~350 KB base memory. Add 100 tabs? Still ~350 KB. The system scales horizontally
                  without growing memory.</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-border-left="3px solid #22c55e">
                <h3 data-st-margin-top="0">🎯 No Framework Bloat</h3>
                <p data-st-margin="0">Zero external dependencies. No virtual DOM. No heavy libraries. Just the browser
                  and pure Vanilla JS.</p>
              </div>
            </div>
            <hr>
            <div data-st-text-align="center" data-st-color="#aaa">
              <p data-st-margin="0"><strong>📊 Benchmark:</strong> "38 listeners total. Zero leaks. Memory flatlines
                at 350 KB." — Grok (xAI)</p>
            </div>
          </div>
          <div data-tab="performance-metrics" data-st-padding="16px" data-spaceless="">
            <h2>Performance Metrics</h2>
            <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="8px" data-st-margin="16px 0">
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))"
                data-st-border-radius="4px">
                <span>Tab Switch (CSS-driven)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">0ms — 60fps</span>
              </div>
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))"
                data-st-border-radius="4px">
                <span>Event Handling (per click)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">&lt; 0.5ms</span>
              </div>
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))"
                data-st-border-radius="4px">
                <span>Nested Tabs (500 levels)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">No stack overflow</span>
              </div>
              <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center"
                data-st-padding="8px 12px" data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))"
                data-st-border-radius="4px">
                <span>Memory Footprint (base)</span>
                <span data-st-color="#22c55e" data-st-font-weight="bold">~350 KB</span>
              </div>
            </div>
            <hr>
            <div data-st-text-align="center" data-st-color="#aaa">
              <p data-st-margin="0"><strong>⚡ The Verdict:</strong> "Wormhole-level architecture with pocket calculator
                resources." — DeepSeek</p>
            </div>
          </div>
          <div data-tab="event-listener-counter" data-st-padding="16px" data-spaceless="" data-swipe-ignore>
            <h2>🔍 Event Listener Inspector</h2>
            <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px" data-st-border-radius="8px"
              data-st-margin="12px 0" data-st-border-left="4px solid var(--accent, #ff6b6b)">
              <p data-st-margin="0">
                <strong>Ever wondered how many event listeners a page actually has?</strong>
                Every click handler, scroll listener, and keyboard shortcut adds up.
                This console script scans the entire DOM and shows you exactly what's happening under the hood.
              </p>
            </div>
            <h3>What It Does</h3>
            <ul data-st-margin="8px 0 16px 0" data-st-padding-left="20px">
              <li>Scans <code>window</code>, <code>document</code>, and every DOM element</li>
              <li>Counts all event listeners attached to each element</li>
              <li>Shows you which elements have the most listeners (hotspots)</li>
              <li>Displays average listeners per element</li>
            </ul>
            <h3>Why This Matters</h3>
            <ul data-st-margin="8px 0 16px 0" data-st-padding-left="20px">
              <li><strong>Performance:</strong> Too many listeners can slow down your page</li>
              <li><strong>Memory leaks:</strong> Orphaned listeners prevent garbage collection</li>
              <li><strong>Debugging:</strong> Find out which components are causing event storms</li>
              <li><strong>Optimization:</strong> YaiTabs uses a minimal set of shared listeners for the entire Speedtab extension!</li>
            </ul>
            <hr>
            <h3>How to Use</h3>
            <ol data-st-margin="8px 0 16px 0" data-st-padding-left="20px">
              <li>Open Developer Tools (F12 or Cmd+Opt+I)</li>
              <li>Go to the <strong>Console</strong> tab</li>
              <li>Copy and paste the script below</li>
              <li>Scream "Go Go Evento!", press Enter, and watch the magic happen 🎤</li>
            </ol>
            <div data-st-bg-color="rgba(0,0,0,0.3)" data-st-padding="16px" data-st-border-radius="8px"
              data-st-font-family="monospace" data-st-font-size="0.85rem" data-st-overflow="auto">
<pre data-st-white-space="pre-wrap" data-st-margin="0" class="hljs"
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
      <div
        data-yai-tabs=""
        data-auto-height=""
        data-st-min-height="100%"
        data-nav="bottom"
        data-color-accent="success"
        data-behavior="zoom"
        data-swipe="">
        <nav data-controller="" data-grow="">
          <button data-tab-action="open" data-open="introduction" data-default="">Introduction</button>
          <button data-tab-action="open" data-open="layout">Layout</button>
          <button data-tab-action="open" data-open="flex-grid">Flex &amp; Grid</button>
          <button data-tab-action="open" data-open="visual">Visual</button>
          <button data-tab-action="open" data-open="live-demo">Live Demo</button>
        </nav>
        <div data-content="">
          <div data-tab="introduction" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>What is the Style API?</h2>
            <p><strong>Declarative CSS without writing CSS.</strong> Use <code>data-st-*</code> attributes to style
              your notes directly in HTML. The browser handles the rest.</p>
            <div data-st-grid="2" data-st-gap="16px" data-st-margin="20px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.03))" data-st-padding="16px"
                data-st-border-radius="8px">
                <h3 data-st-margin-top="0">✅ What it does</h3>
                <ul data-st-margin="0" data-st-padding-left="20px">
                  <li>Applies CSS via HTML attributes</li>
                  <li>Works in notes and trusted HTML surfaces</li>
                  <li>Uses <code>!important</code> to override app defaults</li>
                  <li>Supports length, percentage, color, number, and string values</li>
                </ul>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.03))" data-st-padding="16px"
                data-st-border-radius="8px">
                <h3 data-st-margin-top="0">❌ What it doesn't</h3>
                <ul data-st-margin="0" data-st-padding-left="20px">
                  <li>No inline <code>style=""</code> required</li>
                  <li>No JavaScript needed for styling</li>
                  <li>No CSS class wars</li>
                  <li>No framework-specific syntax</li>
                </ul>
              </div>
            </div>
            <h3>Quick Example</h3>
            <div data-st-bg-color="rgba(0,0,0,0.3)" data-st-padding="16px" data-st-border-radius="8px"
              data-st-font-family="monospace" data-st-font-size="0.85rem">
              <pre data-swipe-ignore data-st-margin="0" data-st-white-space="pre-wrap"
>&lt;div data-st-width="300px"
     data-st-padding="16px"
     data-st-bg-color="var(--st-color-secondary)"
     data-st-border-radius="8px"&gt;
  This card is styled with data-st-* attributes!
&lt;/div&gt;</pre>
            </div>
          </div>
          <div data-tab="layout" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Layout &amp; Sizing</h2>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="16px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-width</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set
                  element width</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-height</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set
                  element height</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-min-width</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set
                  min-width</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-min-height</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set
                  min-height</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-max-width</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set
                  max-width</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-max-height</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">Set
                  max-height</p>
              </div>
            </div>
            <h3>Margin &amp; Padding</h3>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-margin</code> <span
                  data-st-font-size="0.8rem">(all sides)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-padding</code> <span
                  data-st-font-size="0.8rem">(all sides)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-margin-top/bottom/left/right</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-padding-top/bottom/left/right</code>
              </div>
            </div>
            <h3>Border Controls</h3>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-border-radius</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-border</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-border-color</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-border-width</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-border-style</code>
              </div>
            </div>
          </div>
          <div data-tab="flex-grid" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Flex &amp; Grid Utilities</h2>
            <h3>Flex Properties</h3>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-flex</code> <span
                  data-st-font-size="0.8rem">(flex: value)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-gap</code> <span
                  data-st-font-size="0.8rem">(gap between items)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-flex-direction</code> <span
                  data-st-font-size="0.8rem">(row, column)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-align-items</code> <span
                  data-st-font-size="0.8rem">(center, stretch, etc.)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-justify-content</code> <span
                  data-st-font-size="0.8rem">(start, center, end, etc.)</span>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-flex-wrap</code> <span
                  data-st-font-size="0.8rem">(nowrap, wrap)</span>
              </div>
            </div>
            <h4>Typography</h4>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="12px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-font-size</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-font-weight</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-line-height</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-text-align</code>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-white-space</code>
              </div>
            </div>
          </div>
          <div data-tab="visual" data-st-padding="20px" data-spaceless="" data-swipe-ignore>
            <h2>Visual &amp; Color Controls</h2>
            <div data-st-grid="3" data-st-gap="12px" data-st-margin="16px 0">
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-color</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Text color</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-bg-color</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Background color</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-opacity</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Opacity (0-1)</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-object-fit</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  For images</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-box-shadow-x</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Shadow X offset</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-box-shadow-y</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Shadow Y offset</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-box-shadow-blur</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Shadow blur radius</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-box-shadow-spread</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Shadow spread</p>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                data-st-border-radius="6px">
                <code>data-st-box-shadow-type</code>
                <p data-st-margin="4px 0 0" data-st-font-size="0.85rem">
                  Shadow color</p>
              </div>
            </div>
            <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.03))" data-st-padding="16px"
              data-st-border-radius="8px" data-st-border-left="4px solid #22c55e">
              <strong>💡 Pro Tip:</strong> You can use CSS custom properties (variables) like <code>var(--st-color-accent)</code>
              or <code>var(--st-color-secondary)</code> as values!
            </div>
          </div>
          <div data-tab="live-demo" data-st-padding="20px" data-spaceless="">
            <div data-swipe-ignore>
              <h2>Live Demo: Style API in Action</h2>
              <div data-st-grid="3" data-st-gap="16px" data-st-margin="20px 0">
                <div data-st-bg-color="var(--accent, #ff6b6b)" data-st-padding="16px" data-st-border-radius="8px"
                  data-st-display="flex" data-st-align-items="center" data-st-justify-content="center"
                  data-st-min-height="80px">
                  <span data-st-color="#fff" data-st-font-weight="bold">Flex Centered</span>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px" data-st-width="100%" data-st-max-width="200px">
                  <h3 data-st-margin-top="0">Max Width</h3>
                  <p data-st-margin="0" data-st-font-size="0.9rem">
                    Limited to 200px</p>
                </div>
                <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                  data-st-border-radius="8px" data-st-font-size="1.2rem" data-st-text-align="center"
                  data-st-line-height="1.8">
                  <p data-st-margin="0"><strong>Big &amp; Centered</strong></p>
                  <p data-st-margin="0" data-st-font-size="0.8rem">
                    Using <code>data-st-font-size</code> &amp; <code>data-st-text-align</code></p>
                </div>
              </div>
              <hr>
              <div data-st-bg-color="rgba(0,0,0,0.3)" data-st-padding="16px" data-st-border-radius="8px"
                data-st-font-family="monospace" data-st-font-size="0.8rem"
                data-st-overflow="scroll">
                <pre data-swipe-ignore data-st-margin="0" data-st-white-space="pre-wrap"
>&lt;div data-st-grid="1" data-st-gap="16px"&gt;
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
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.03))" data-st-padding="12px 16px"
                data-st-border-radius="6px" data-st-margin="16px 0 0"
                data-st-border-left="4px solid var(--accent, #ff6b6b)">
                <strong>🎯 Key Takeaway:</strong> Everything you see here — colors, spacing, sizing, flex, grid —
                is controlled entirely with <code>data-st-*</code> attributes. No inline styles, no JS.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div data-tab="examples" data-spaceless="">
      <div data-yai-tabs="" data-auto-height data-st-min-height="100%" data-nav="right" data-color-accent="info" data-behavior="blur" data-closable="false"
        data-swipe="" data-spaceless="">
        <nav data-controller="" data-grow="">
          <button data-tab-action="open" data-open="card-grid" data-default="">Card Grid</button>
          <button data-tab-action="open" data-open="stats-dashboard">Stats Dashboard</button>
          <button data-tab-action="open" data-open="component-showcase">Component Showcase</button>
        </nav>
        <div data-content="" data-st-min-height="100%" data-swipe-ignore>
          <div data-tab="card-grid" data-st-padding="20px" data-spaceless="">
            <h2>Card Grid with Nested Tabs</h2>


            <div data-yai-tabs="" data-auto-height data-nav="left" data-color-accent="warning" data-behavior="fade"
              data-st-margin="16px 0" data-spaceless="">
              <nav data-controller="">
                <button data-tab-action="open" data-open="category-1" data-default="">Design</button>
                <button data-tab-action="open" data-open="category-2">Development</button>
                <button data-tab-action="open" data-open="category-3">Productivity</button>
              </nav>
              <div data-content="">
                <div data-tab="category-1" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="3" data-st-gap="12px">
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h3 data-st-margin-top="0">UI/UX Design</h3>
                      <p data-st-font-size="0.9rem">
                        Interactive prototypes with YaiTabs</p>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Design Systems</h4>
                      <p data-st-font-size="0.9rem">
                        Reusable component libraries</p>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">User Research</h4>
                      <p data-st-font-size="0.9rem">
                        Findings &amp; insights documentation</p>
                    </div>
                  </div>
                </div>
                <div data-tab="category-2" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="3" data-st-gap="12px">
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Frontend</h4>
                      <p data-st-font-size="0.9rem">
                        React, Vue, Svelte, Vanilla</p>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Backend</h4>
                      <p data-st-font-size="0.9rem">
                        Node, Python, Go, Rust
                      </p>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">DevOps</h4>
                      <p data-st-font-size="0.9rem">
                        CI/CD, Docker, Kubernetes</p>
                    </div>
                  </div>
                </div>
                <div data-tab="category-3" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="3" data-st-gap="12px">
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Task Management</h4>
                      <p data-st-font-size="0.9rem">
                        Kanban, GTD, Eisenhower
                      </p>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Knowledge Base</h4>
                      <p data-st-font-size="0.9rem">
                        Personal wiki, Zettelkasten</p>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                      data-st-border-radius="8px">
                      <h4 data-st-margin-top="0">Goal Tracking</h4>
                      <p data-st-font-size="0.9rem">
                        OKRs, habit tracking</p>
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
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="var(--accent, #ff6b6b)">247
                </div>
                <div data-st-font-size="0.85rem">Bookmarks</div>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="#4a9eff">42</div>
                <div data-st-font-size="0.85rem">Feed Sources</div>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="#22c55e">1,284</div>
                <div data-st-font-size="0.85rem">Notes</div>
              </div>
              <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="16px"
                data-st-border-radius="8px" data-st-text-align="center">
                <div data-st-font-size="2rem" data-st-font-weight="bold" data-st-color="#eab308">12</div>
                <div data-st-font-size="0.85rem">Workspaces</div>
              </div>
            </div>
            <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.03))" data-st-padding="16px"
              data-st-border-radius="8px" data-st-margin="16px 0">
              <h3 data-st-margin-top="0">Recent Activity</h3>
              <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="8px">
                <div data-st-display="flex" data-st-justify-content="space-between" data-st-padding="8px 0"
                  data-st-border-bottom="1px solid rgba(255,255,255,0.05)">
                  <span>📝 Created new note: "Style API Reference"</span>
                  <span data-st-font-size="0.8rem">2 min ago</span>
                </div>
                <div data-st-display="flex" data-st-justify-content="space-between" data-st-padding="8px 0"
                  data-st-border-bottom="1px solid rgba(255,255,255,0.05)">
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
          <div data-tab="component-showcase" data-st-padding="20px" data-spaceless="">
            <h2>Component Showcase</h2>
            <p>
              Complex layouts built with nested tabs + style attributes</p>
            <div data-yai-tabs=""
              data-auto-height
              data-nav="bottom"
              data-color-accent="success"
              data-behavior="zoom"
              data-st-margin="16px 0"
              data-st-min-height="300px"
              data-spaceless="">
              <nav data-controller="">
                <button data-tab-action="open" data-open="component-1" data-default="">Dashboard</button>
                <button data-tab-action="open" data-open="component-2">Analytics</button>
                <button data-tab-action="open" data-open="component-3">Settings</button>
              </nav>
              <div data-content="">
                <div data-tab="component-1" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="2:1" data-st-gap="16px">
                    <div>
                      <h3 data-st-margin-top="0">Main Content</h3>
                      <p>
                        This layout uses <code>data-st-grid="2:1"</code> for a 2fr:1fr ratio</p>
                      <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                        data-st-border-radius="6px">
                        <span>📊 Chart placeholder</span>
                      </div>
                    </div>
                    <div>
                      <h3 data-st-margin-top="0">Sidebar</h3>
                      <div data-st-display="flex" data-st-flex-direction="column" data-st-gap="8px">
                        <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="8px 12px"
                          data-st-border-radius="4px">Recent items</div>
                        <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="8px 12px"
                          data-st-border-radius="4px">Quick actions</div>
                        <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="8px 12px"
                          data-st-border-radius="4px">Notifications</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-tab="component-2" data-st-padding="16px" data-spaceless="">
                  <div data-st-grid="2" data-st-gap="12px">
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                      data-st-border-radius="6px" data-st-text-align="center">
                      <strong>📈 Visitors</strong>
                      <div data-st-font-size="1.5rem" data-st-font-weight="bold" data-st-color="#4a9eff">12,847</div>
                    </div>
                    <div data-st-bg-color="var(--bg-card, rgba(255,255,255,0.05))" data-st-padding="12px"
                      data-st-border-radius="6px" data-st-text-align="center">
                      <strong>📊 Bounce Rate</strong>
                      <div data-st-font-size="1.5rem" data-st-font-weight="bold" data-st-color="#22c55e">34%</div>
                    </div>
                  </div>
                </div>
                <div data-tab="component-3" data-st-padding="16px" data-spaceless="">
                  <div data-st-max-width="340px" data-st-display="flex" data-st-flex-direction="column" data-st-gap="12px">
                    <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center">
                      <span>Dark Mode</span>
                      <span data-st-bg-color="var(--accent, #ff6b6b)" data-st-padding="4px 12px"
                        data-st-border-radius="12px" data-st-color="#fff" data-st-font-size="0.8rem">Enabled</span>
                    </div>
                    <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center">
                      <span>Auto-refresh Feeds</span>
                      <span data-st-bg-color="#22c55e" data-st-padding="4px 12px" data-st-border-radius="12px"
                        data-st-color="#fff" data-st-font-size="0.8rem">On</span>
                    </div>
                    <div data-st-display="flex" data-st-justify-content="space-between" data-st-align-items="center">
                      <span>Sync Mode</span>
                      <span data-st-bg-color="#eab308" data-st-padding="4px 12px" data-st-border-radius="12px"
                        data-st-color="#fff" data-st-font-size="0.8rem">Manual</span>
                    </div>
                  </div>
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
