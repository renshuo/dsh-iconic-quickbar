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
 *  - panels outside the requested set leave the row and remain reachable from
 *    the More menu the row keeps beside them.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-iconic-quickbar',
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

    /** Panels that keep a button in the row; everything else moves to More. */
    const KEPT_LABELS = [
      '插件', 'Plugins',
      '任务看板', 'Task Board',
      '待办', 'Todos',
      '资料馆', 'Library',
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

      // A rendered text label is what distinguishes the wide sidebar from the
      // collapsed rail, so these rules leave the rail alone.
      const wide = ':has(> button > span + span)'
      // The More button lives inside the Menu's anchor <span> (Menu.tsx wraps
      // its anchor that way), so it is one level deeper than a panel row. The
      // wrapper also holds the open menu list, so the inner part is pinned to
      // the trigger button: `button[aria-haspopup]` and its own children only —
      // never a bare descendant selector, which would reach the menu rows.
      const rowButton = sel => [
        navOf(`${wide} > button${sel}`),
        navOf(`${wide} > span > button[aria-haspopup]${sel}`),
      ].join(',\n')

      const notKept = KEPT_LABELS.map(l => `:not([aria-label="${l}"])`).join('')
      // Our own switch is a direct child too, and must survive this rule.
      const rest = join(PANEL_NAV_LABELS.map(l =>
        `${gate} nav[aria-label="${l}"] > button:not([aria-haspopup]):not([data-iqb-toggle])${notKept}`))

      return `
/* ---- the mode switch ---- */
/* Native mode: render exactly like a stock panel row (glyph + caption) so it
   reads as a peer of the rows above it. */
.iqb-toggle {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  width: auto;
  min-height: 36px;
  margin: 0 2px;
  padding: 7px 8px;
  box-sizing: border-box;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
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

/* Icon mode: the switch collapses to one more square icon at the row's end. */
${navOf(`${wide} > button.iqb-toggle`)} {
  width: 32px;
  height: 32px;
  min-height: 0;
  margin: 0 0 0 auto;
  padding: 0;
  justify-content: center;
  gap: 0;
  flex: none;
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

/* ---- one horizontal row, directly under the New Session button ---- */
${navOf(wide)} {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}

/* ---- compact square hit areas, icon only ---- */
${rowButton('')} {
  flex: none;
  width: 32px;
  height: 32px;
  min-height: 0;
  margin: 0;
  padding: 0;
  justify-content: center;
  gap: 0;
}

${rowButton(':hover')} {
  background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 10%, transparent));
}

/* The text label is hidden; aria-label still names the button. This covers
   both the panel rows and the More button inside the Menu's anchor span. */
${rowButton(' > span + span')} {
  display: none;
}

/* ---- panels outside the requested set move into the More menu ---- */
${rest} {
  display: none !important;
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
