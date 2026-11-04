/**
 * Sidebar icon bar for the DSH left sidebar.
 *
 * Restyles the sidebar's own global-panel list (`sidebar.panellist` — a vertical
 * <nav> sitting directly under the New Session button) into one horizontal row
 * of text-less icon buttons, and appends a mode switch at the row's right edge
 * that toggles between this icon row and the untouched original list.
 *
 * The native rows keep their own glyphs, selected-panel highlight, accessible
 * names, and the list's More button rides the same row, so this stays a
 * presentation change: no plugin is disabled and no panel loses its launcher.
 *
 * Icon mode is carried by three scoped rule groups, all gated on
 * `html:not([data-iqb-mode="native"])` so the switch restores the stock sidebar
 * exactly:
 *  - the row layout applies only while rows still render their text label
 *    (i.e. the sidebar is expanded; the collapsed rail keeps its stacked icons,
 *    where a row of them would not fit);
 *  - labels are hidden but aria-label still names each button;
 *  - every registered panel keeps its button — the row wraps, so the set can
 *    grow without any launcher dropping out.
 *
 * No panel is named anywhere in this file: the row is built from whatever the
 * host registered, so a new or renamed launcher needs no change here.
 *
 * Host markup this targets, and why each shape is matched: through 0.2.1 the
 * panel list held its `<button>` rows directly; 0.2.2 added a per-row list-item
 * `<div>` wrapper (the row now carries a hover-revealed unpin button beside it)
 * and moved to 32px rows. Every rule therefore covers both the wrapper and the
 * bare button, and the "expanded sidebar" test keys on the caption span rather
 * than on either structure.
 */
window.__ModuleLoader__.load({
  id: '@renshuo/dsh-iconic-quickbar',
  factory(require) {
    /** Locale namespace for the switch's accessible name. */
    const NS = 'sidebar-icon-bar'
    /** Persisted choice; absence of the DOM attribute means icon mode. */
    const STORAGE_KEY = 'dsh-iconic-quickbar:mode'
    const ATTR = 'data-iqb-mode'
    const MODE_ICON = 'icon'
    const MODE_NATIVE = 'native'

    const LOCALES = {
      zh: {
        'action.toNative': '切换到原版模式',
        'action.toIcon': '切换到图标模式',
      },
      en: {
        'action.toNative': 'Switch to the original list',
        'action.toIcon': 'Switch to the icon row',
      },
    }

    /**
     * Visible caption per mode. Icon mode renders no text (it is one more
     * square icon in the row); native mode sits among the stock rows, which
     * all carry a caption, so it needs one to read as a peer of them.
     */
    const CAPTIONS = {
      zh: { toIcon: '图标模式', toNative: '原版模式' },
      en: { toIcon: 'Icon row', toNative: 'Original list' },
    }

    /** aria-labels of the sidebar's panel-list <nav>, across shipped locales. */
    const PANEL_NAV_LABELS = [
      '全局面板', 'Global panels', 'グローバルパネル', 'Paneles globales',
      'Panneaux globaux', 'Globale Bereiche', 'Глобальные панели', 'Painéis globais',
    ]

    const STYLE_ID = 'dsh-iconic-quickbar-style'

    /** Build the scoped stylesheet from the label tables above. */
    function buildCss() {
      // Every selector is expanded per locale explicitly: appending a
      // descendant combinator to a comma-joined list would bind it to the last
      // selector only, silently mis-targeting the other locales.
      const join = parts => parts.join(',\n')
      // Icon-mode rules only; dropping the attribute restores the stock list.
      const gate = 'html:not([data-iqb-mode="native"])'
      const navOf = sel => join(PANEL_NAV_LABELS.map(l => `${gate} nav[aria-label="${l}"]${sel}`))
      // Mode-independent nav rules (the rail layout), so the switch also sits
      // correctly while the list is showing its stock rows.
      const navOfAny = sel => join(PANEL_NAV_LABELS.map(l => `nav[aria-label="${l}"]${sel}`))

      // A rendered caption span is what tells the wide sidebar from the 36px
      // collapsed rail, so these rules leave the rail alone. Both row shapes
      // count: the button directly under the nav (<= 0.2.1) or inside its
      // list-item wrapper (>= 0.2.2). The switch's own caption is excluded —
      // otherwise the switch alone would make the rail look expanded and turn
      // its 36px column into a wrapping row of icons.
      const wide = ':has(> button:not([data-iqb-toggle]) > span + span, > div > button > span + span)'
      const narrow = `:not(${wide})`

      // The box squared off per control: 0.2.2's list-item wrapper, the bare
      // row button on earlier builds, or the More trigger inside the Menu's
      // anchor span.
      const rowBox = join([
        navOf(`${wide} > div:has(> button)`),
        navOf(`${wide} > button:not([data-iqb-toggle])`),
        navOf(`${wide} > span > button[aria-haspopup]`),
      ])

      // A row control, plus the More trigger one level deeper inside the
      // Menu's anchor <span>. That span also holds the open menu list, so the
      // descendant part is pinned to the trigger itself —
      // `button[aria-haspopup]` and its own children only, never a bare
      // descendant selector, which would reach the menu rows' captions.
      const rowButton = sel => join([
        navOf(`${wide} > div > button${sel}`),
        navOf(`${wide} > button:not([data-iqb-toggle])${sel}`),
        navOf(`${wide} > span > button[aria-haspopup]${sel}`),
      ])

      return `
/* ---- the mode switch ---- */
/* Stock row geometry: a 3px wrapper inset plus a 3px button inset plus the
   row padding is where the host's captions start, so the switch lines up with
   the rows above it in either mode. */
.iqb-toggle {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--dsh-sidebar-label-gap, 6px);
  width: auto;
  min-height: 32px;
  margin: 0;
  padding: 5px 9px;
  box-sizing: border-box;
  border: none;
  border-inline: var(--dsh-sidebar-paint-inset, 3px) solid transparent;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  background-clip: padding-box;
  color: var(--dsw-alias-label-primary, currentColor);
  font: inherit;
  line-height: 22px;
  text-align: left;
  cursor: pointer;
}
.iqb-toggle:hover {
  background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 10%, transparent));
}
.iqb-toggle:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, currentColor));
  outline-offset: -2px;
}
.iqb-toggle-glyph {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.iqb-toggle-caption {
  color: var(--dsw-alias-label-secondary, currentColor);
}

/* ---- one horizontal row, directly under the New Session button ---- */
${navOf(wide)} {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}

/* ---- compact square hit areas, icon only ---- */
${rowBox} {
  flex: none;
  width: 32px;
  height: 32px;
  min-height: 0;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  align-items: center;
  justify-content: center;
  gap: 0;
}

/* The row control fills 0.2.2's wrapper; on earlier builds the rule above
   squares the button itself. */
${navOf(`${wide} > div > button`)} {
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: none;
  align-items: center;
  justify-content: center;
  gap: 0;
}

/* 0.2.2 keeps a hover-revealed unpin button in that same wrapper. A 32px
   square has no room for it — it would sit over the glyph and turn the
   panel's click into an unpin — so it is hidden here; unpinning stays in the
   stock list, one switch click away. Only the wrapper's *second* button is
   touched, so a panel row is never hit. */
${navOf(`${wide} > div > button:last-of-type:not(:first-of-type)`)} {
  display: none !important;
}

/* The caption is hidden; aria-label still names the button. This covers the
   panel rows in both shapes and the More button inside the Menu's span. */
${rowButton(' > span + span')} {
  display: none;
}

/* Every registered panel keeps its button. The row wraps, so a plugin that
   adds a fifth or sixth launcher simply flows onto a second line; nothing here
   names a panel, so no launcher can go missing when the set changes. */

/* Icon mode: the switch collapses into one more 32px square at the row's end. */
${navOf(`${wide} > button.iqb-toggle`)} {
  width: 32px;
  height: 32px;
  min-height: 0;
  margin: 0 0 0 auto;
  padding: 0;
  border-inline-width: 0;
  justify-content: center;
  gap: 0;
}
${navOf(`${wide} > button.iqb-toggle > .iqb-toggle-caption`)} {
  display: none;
}
${navOf(`${wide} > button.iqb-toggle > .iqb-toggle-glyph`)} {
  color: var(--dsw-alias-label-secondary, currentColor);
}
${navOf(`${wide} > button.iqb-toggle:hover > .iqb-toggle-glyph`)} {
  color: var(--dsw-alias-label-primary, currentColor);
}

/* The 36px rail is glyph-only in either mode: a caption there would overflow
   the column and push the glyph off the rail's centreline. */
${navOfAny(`${narrow} > button.iqb-toggle`)} {
  width: 36px;
  height: 36px;
  min-height: 0;
  margin: 0;
  padding: 0;
  border-inline-width: 0;
  justify-content: center;
  gap: 0;
}
${navOfAny(`${narrow} > button.iqb-toggle > .iqb-toggle-caption`)} {
  display: none;
}
`
    }

    /** Inject the stylesheet; the returned disposer removes it. */
    function installStyle() {
      if (typeof document === 'undefined') return () => {}
      const existing = document.getElementById(STYLE_ID)
      if (existing !== null) return () => { existing.remove() }
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = buildCss()
      document.head.appendChild(el)
      return () => { el.remove() }
    }

    const SVG_NS = 'http://www.w3.org/2000/svg'

    /** Build a stroke icon of the given edge length from [tag, attributes] pairs. */
    function icon(parts, size = 18) {
      const svg = document.createElementNS(SVG_NS, 'svg')
      const base = {
        viewBox: '0 0 24 24', width: String(size), height: String(size),
        fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
        'stroke-linecap': 'round', 'aria-hidden': 'true',
      }
      for (const [key, value] of Object.entries(base)) svg.setAttribute(key, value)
      for (const [tag, attrs] of parts) {
        const node = document.createElementNS(SVG_NS, tag)
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
        svg.appendChild(node)
      }
      return svg
    }

    /** Offered while in icon mode: go back to the original list. */
    const LIST_GLYPH = [
      ['line', { x1: 4, y1: 7, x2: 20, y2: 7 }],
      ['line', { x1: 4, y1: 12, x2: 20, y2: 12 }],
      ['line', { x1: 4, y1: 17, x2: 20, y2: 17 }],
    ]

    /** Offered while in original mode: switch to the icon row. */
    const GRID_GLYPH = [
      ['rect', { x: 4, y: 4, width: 6.5, height: 6.5, rx: 1.5 }],
      ['rect', { x: 13.5, y: 4, width: 6.5, height: 6.5, rx: 1.5 }],
      ['rect', { x: 4, y: 13.5, width: 6.5, height: 6.5, rx: 1.5 }],
      ['rect', { x: 13.5, y: 13.5, width: 6.5, height: 6.5, rx: 1.5 }],
    ]

    function readMode() {
      try {
        return localStorage.getItem(STORAGE_KEY) === MODE_NATIVE ? MODE_NATIVE : MODE_ICON
      } catch {
        return MODE_ICON
      }
    }

    function saveMode(mode) {
      try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* private mode */ }
    }

    /** Icon mode is the CSS default, so only native mode needs the attribute. */
    function paintMode(mode) {
      const root = typeof document === 'undefined' ? null : document.documentElement
      if (root === null || root === undefined) return
      if (mode === MODE_NATIVE) root.setAttribute(ATTR, MODE_NATIVE)
      else root.removeAttribute(ATTR)
    }

    /**
     * Append the mode switch to the panel-list nav and keep it there.
     *
     * The list is host-rendered, so the button is adopted into its DOM rather
     * than registered through a slot (no slot renders inside the panel rows).
     * React may drop adopted children on re-render, so a MutationObserver
     * re-seats the button whenever it detaches.
     * @returns disposer that removes the observer, the button and the mode.
     */
    function mountSwitch(ctx) {
      if (typeof document === 'undefined') return () => {}
      const t = ctx.locale.bind(NS)
      // Read the active language so the caption follows the UI language.
      const pickCaption = key => {
        let lang = 'zh'
        try { lang = ctx.locale.getLocale()?.id ?? 'zh' } catch { /* keep zh */ }
        const table = CAPTIONS[lang] ?? CAPTIONS.zh
        return table[key] ?? CAPTIONS.zh[key]
      }

      let mode = readMode()
      paintMode(mode)

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'iqb-toggle'
      button.setAttribute('data-iqb-toggle', '')

      const onClick = () => {
        mode = mode === MODE_ICON ? MODE_NATIVE : MODE_ICON
        saveMode(mode)
        paintMode(mode)
        sync()
      }
      button.addEventListener('click', onClick)

      const findNav = () => {
        for (const label of PANEL_NAV_LABELS) {
          const nav = document.querySelector(`nav[aria-label="${label}"]`)
          if (nav !== null) return nav
        }
        return null
      }

      // Presentation is rebuilt only when the mode actually changed, so the
      // observer's own wakeups settle instead of looping.
      let painted = null
      const sync = () => {
        if (painted !== mode) {
          const iconMode = mode === MODE_ICON
          // The accessible name says what the click DOES; the caption names the
          // mode the button is offering, matching the adjacent native rows.
          const action = t(iconMode ? 'action.toNative' : 'action.toIcon')
          const captionText = pickCaption(iconMode ? 'toNative' : 'toIcon')
          button.setAttribute('aria-label', action)
          button.setAttribute('title', action)
          // Mirrors the native row shape (glyph span + label span) so the CSS
          // that hides row captions in icon mode covers this button too.
          const glyph = document.createElement('span')
          glyph.className = 'iqb-toggle-glyph'
          glyph.setAttribute('aria-hidden', 'true')
          glyph.appendChild(icon(iconMode ? LIST_GLYPH : GRID_GLYPH, iconMode ? 18 : 16))
          const caption = document.createElement('span')
          caption.className = 'iqb-toggle-caption'
          caption.textContent = captionText
          button.replaceChildren(glyph, caption)
          painted = mode
        }
        const nav = findNav()
        if (nav !== null && button.parentNode !== nav) nav.appendChild(button)
      }

      let queued = false
      const schedule = () => {
        if (queued) return
        queued = true
        const run = () => { queued = false; sync() }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
        else setTimeout(run, 16)
      }

      const observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
      sync()

      return () => {
        observer.disconnect()
        button.removeEventListener('click', onClick)
        button.remove()
        document.documentElement.removeAttribute(ATTR)
      }
    }

    return {
      inject: ['locale'],
      apply(ctx) {
        // ctx.effect owns each resource's lifetime: the fiber calls the returned
        // disposer when this plugin is stopped, reloaded or removed.
        ctx.effect(() => ctx.locale.register(NS, { zh: LOCALES.zh, en: LOCALES.en }))
        ctx.effect(() => installStyle())
        ctx.effect(() => mountSwitch(ctx))
      },
    }
  },
})
