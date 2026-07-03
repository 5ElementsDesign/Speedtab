# Speedtab Next — Grid System Implementation Plan

## Current implementation order

1. Build the inner page grid with `data-*` hooks only.
2. Prove the three desktop/mobile layout cases with placeholder module cards:
   - one module in a column
   - two stacked modules in a neighboring column
   - multiple rows
3. Keep the data model temporary at first:
   - render a static row/column/module view model in `features/pages/render.js`
   - do not redesign persistence before the layout is proven
4. Once the layout is stable, replace placeholder cards with real module shells.
5. Only after that, connect the eventual row/column/module persistence model.

## First implementation slice

The first slice should stay intentionally narrow:

- `data-page-grid`
- `data-grid-row`
- `data-grid-col`
- `data-module-card`

No resizing UI, no drag/drop, no module content types yet. The goal is to prove the
layout behavior entirely in CSS before wiring real module content into it.

This document proposes a highly flexible, performant, and pure CSS layout architecture to solve the dynamic grid system requirements for Speedtab Next dashboard modules.

---

## The Layout Challenge

We need a layout system where:
1. **Row-level Partitioning**: The user can decide how many columns are in a grid row, and their respective widths.
2. **Horizontal Alignment (Grid)**: Modules align horizontally across column tracks in a 12-column grid.
3. **Vertical Auto-Stretching (Flexbox)**:
   - If a column has only **one** module (e.g., Module A with a `min-height: 400px`), any column next to it with a single module (Module B) must stretch to match Module A's height.
   - If a column has **multiple** modules (e.g., Module B and Module C), they should stack vertically and share the height of the row (each getting an equal share of the vertical space).
4. **Mobile Responsiveness**: The grid must collapse gracefully on small viewports.

---

## Recommended Architecture: CSS Grid & Flexbox Hybrid

Rather than using complex JavaScript height calculation scripts (which degrade performance, cause layout shifts, and add lifecycle overhead), we can achieve this layout **entirely in pure CSS** using a nested row-column hierarchy.

### The Layout Paradigm

- **Grid Row (`.st-grid-row`)**: A 12-column CSS Grid container that aligns columns horizontally.
- **Grid Column (`.st-grid-col`)**: A grid item that spans $N$ columns. It behaves as a **vertical flex container** (`flex-direction: column`) with `align-items: stretch` and `height: 100%`.
- **Module Card (`.st-module`)**: Flex children inside the column container. On desktop, they get `flex: 1 1 0%` and `min-height: 0` so they automatically split the column's stretched height equally.

---

## 1. HTML Markup Structure

Here is how the markup looks for the scenario where:
* The left column (Column 1, width 6/12) contains **Module A** (tall box, `min-height: 400px`).
* The right column (Column 2, width 6/12) contains **Module B** and **Module C** (stacked vertically, sharing the 400px height).

```html
<div class="user-generated-wrapper">
  <!-- A grid row container -->
  <div class="st-grid-row" data-row-id="row-1">

    <!-- Column 1: Spans 6 of 12 columns -->
    <div class="st-grid-col" style="--st-col-span: 6;">
      <section data-module="mod-a" class="st-module" style="min-height: 400px;">
        <header class="st-module-header">
          <h3>Module A (High Box)</h3>
        </header>
        <div class="st-module-body">
          <!-- Module Content -->
        </div>
      </section>
    </div>

    <!-- Column 2: Spans 6 of 12 columns -->
    <div class="st-grid-col" style="--st-col-span: 6;">

      <!-- Module B (Shares height with Module C) -->
      <section data-module="mod-b" class="st-module">
        <header class="st-module-header">
          <h3>Module B</h3>
        </header>
        <div class="st-module-body">
          <!-- Module Content -->
        </div>
      </section>

      <!-- Module C (Shares height with Module B) -->
      <section data-module="mod-c" class="st-module">
        <header class="st-module-header">
          <h3>Module C</h3>
        </header>
        <div class="st-module-body">
          <!-- Module Content -->
        </div>
      </section>

    </div>

  </div>
</div>
```

---

## 2. CSS Styling Implementation

Add these rules to `src/next/styles/components.css`. These rules leverage modern CSS custom properties for customizable column spanning, smooth transitions, and premium dark glassmorphism.

```css
/* ==========================================================================
   Speedtab Next Grid & Module System
   ========================================================================== */

/* Outer wrapper with max-width boundaries */
.user-generated-wrapper {
  max-width: var(--st-page-max-width, 1280px);
  margin: 0 auto;
  padding: var(--st-spacing-lg, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-lg, 24px); /* Vertical space between rows */
  width: 100%;
  box-sizing: border-box;
}

/* Grid Row container */
.st-grid-row {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md, 16px); /* Default stack on mobile */
  width: 100%;
}

/* Desktop layout (768px and up) */
@media (min-width: 768px) {
  .st-grid-row {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--st-spacing-md, 16px);
    align-items: stretch; /* Forces all columns in the same row to match height */
  }

  .st-grid-col {
    grid-column: span var(--st-col-span, 12);
    display: flex;
    flex-direction: column;
    gap: var(--st-spacing-md, 16px); /* Space between stacked modules in column */
    height: 100%; /* Stretch to fill grid row height */
    justify-content: stretch;
  }

  /* Distribute vertical space equally when multiple modules exist in a column */
  .st-grid-col > .st-module {
    flex: 1 1 0%;
    min-height: 0; /* Allows flexbox to shrink the modules properly if parent changes */
  }
}

/* Premium Module Styling */
.st-module {
  display: flex;
  flex-direction: column;
  background: var(--st-module-bg, rgba(30, 30, 46, 0.45));
  backdrop-filter: blur(16px);
  border: 1px solid var(--st-module-border, rgba(255, 255, 255, 0.06));
  border-radius: 0;
  padding: 16px;
  color: var(--st-text-color, #cdd6f4);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-sizing: border-box;
}

.st-module:hover {
  border-color: var(--st-module-border-hover, rgba(255, 255, 255, 0.12));
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.st-module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--st-module-divider, rgba(255, 255, 255, 0.05));
  padding-bottom: 8px;
}

.st-module-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--st-text-primary, #f5e0dc);
}

.st-module-body {
  flex: 1; /* Stretches the body area to fill remaining card height */
  overflow: auto; /* Handles inner scroll for heavy content */
  min-height: 0;
}
```

---

## 3. Data Schema (IndexedDB / State)

To represent this layout model in the database or store, we model the hierarchy cleanly.

```json
{
  "rows": [
    {
      "id": "row_unique_1",
      "columns": [
        {
          "id": "col_unique_1_1",
          "span": 6,
          "modules": [
            {
              "id": "mod_unique_a",
              "title": "Module A (High Box)",
              "minHeight": "400px",
              "widgetType": "weather",
              "config": {}
            }
          ]
        },
        {
          "id": "col_unique_1_2",
          "span": 6,
          "modules": [
            {
              "id": "mod_unique_b",
              "title": "Module B",
              "widgetType": "system-info",
              "config": {}
            },
            {
              "id": "mod_unique_c",
              "title": "Module C",
              "widgetType": "bookmarks",
              "config": {}
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 4. Javascript Render Functions

Following the core design principles of Speedtab Next (pure functions returning HTML template strings with escaped values), we can implement layout rendering in `src/next/features/pages/render.js` (or in a new `features/modules/render.js`):

```javascript
import { escapeHtml } from '../../utils/html.js';

/**
 * Renders a single Module card.
 * Handles custom dynamic styles such as minHeight safely.
 */
function renderModule(module) {
  const styles = [];
  if (module.minHeight) {
    styles.push(`min-height: ${escapeHtml(module.minHeight)}`);
  }

  const styleAttr = styles.length ? ` style="${styles.join('; ')}"` : '';

  return `
    <section data-module="${escapeHtml(module.id)}" class="st-module"${styleAttr}>
      <header class="st-module-header">
        <h3>${escapeHtml(module.title)}</h3>
        <!-- Additional module actions/dropdowns can go here -->
      </header>
      <div class="st-module-body">
        <!-- Render widget content dynamically based on widgetType -->
        <div class="st-widget-${escapeHtml(module.widgetType)}">
          Content for ${escapeHtml(module.title)}
        </div>
      </div>
    </section>
  `;
}

/**
 * Renders a column container.
 * Passes the --st-col-span CSS variable down inline.
 */
function renderColumn(column) {
  const span = column.span || 12;
  const modulesHtml = (column.modules || []).map(renderModule).join('');

  return `
    <div class="st-grid-col" style="--st-col-span: ${escapeHtml(span.toString())};">
      ${modulesHtml}
    </div>
  `;
}

/**
 * Renders a horizontal Grid Row.
 */
function renderRow(row) {
  const columnsHtml = (row.columns || []).map(renderColumn).join('');

  return `
    <div class="st-grid-row" data-row-id="${escapeHtml(row.id)}">
      ${columnsHtml}
    </div>
  `;
}

/**
 * Main entry point for rendering user page layout.
 */
export function renderUserLayout(layout) {
  if (!layout || !layout.rows || layout.rows.length === 0) {
    return `
      <div class="st-next-page-placeholder">
        <p>No modules created yet. Click "Add Row" or "Add Module" to start.</p>
      </div>
    `;
  }

  const rowsHtml = layout.rows.map(renderRow).join('');

  return `
    <div class="user-generated-wrapper">
      ${rowsHtml}
    </div>
  `;
}
```

---

## 5. Layout Interaction & Editing (No-Lifecycle Approach)

Since Speedtab Next avoids complex state-binding lifecycles, layout mutations (adding modules, changing spans, or rearranging) are achieved using **event-driven mutations** followed by a full container re-render:

### A. Changing Column Width
The user triggers a column width change (e.g. from span `6` to span `4`):
1. User clicks a button like `<button data-click="adjustColSpan" data-col-id="col_1_2" data-value="4">`.
2. The click handler catches the action in `actions/layout.js`:
   ```javascript
   export const layoutActions = {
     adjustColSpan(target) {
       const colId = target.dataset.colId;
       const newSpan = parseInt(target.dataset.value, 10);

       // Update state/database
       updateColumnSpanInDb(colId, newSpan);

       // Re-render layout wrapper in place
       renderActivePageLayout();
     }
   }
   ```
3. Because the custom CSS property `--st-col-span` is mapped inline, the column instantly resizes to take up $\frac{4}{12}$ of the width, and other columns adjust.

### B. Drag-and-Drop Reordering
Since columns are vertical flexboxes and rows are grid containers, a drag-and-drop library like **SortableJS** can be initialized on `.st-grid-row` (for sorting columns horizontally) and on `.st-grid-col` (for sorting modules vertically):
1. In `app/handler.js`, set up observers or delegate standard drag events.
2. On drag-end, extract the new IDs order:
   ```javascript
   const moduleIds = Array.from(columnEl.children).map(el => el.dataset.module);
   updateModuleSortOrderInDb(colId, moduleIds);
   ```
3. Re-render. This keeps data and UI completely synchronized without heavy virtual-DOM overhead.
