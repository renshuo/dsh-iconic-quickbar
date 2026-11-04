/**
 * Pixel check for the icon row, run against the host's own stylesheet.
 *
 * The unit suite asserts the rules exist and hit the right elements; it cannot
 * tell whether the result actually looks right, because jsdom does not lay
 * anything out. This script closes that gap without a running DSH: it pulls
 * the INSTALLED host's compiled sidebar + theme CSS out of the DSH checkout,
 * rebuilds the exact panel-list DOM the host renders, loads `client.js` into
 * Chromium, and then measures and screenshots both modes.
 *
 * So when the host ships a new sidebar, this reports the real geometry —
 * which is how the 0.2.2 per-row list-item wrapper (and the 32px rows that
 * came with it) was caught.
 *
 * Usage:
 *   npm run visual            # measure + write .debug/*.png
 *   DSH_REPO=/path npm run visual
 *
 * Skipped with a message when the checkout, Playwright, or a Chromium build is
 * missing; it never fails the ordinary `npm test` run.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.debug')
const DSH_REPO = process.env.DSH_REPO ?? '/home/backup/app/deepseek-harness/deepseek-harness'
const SOURCE = readFileSync(join(ROOT, 'client.js'), 'utf8')

/** Give up with a readable reason instead of a stack trace. */
function skip(reason) {
  console.log(`visual check skipped: ${reason}`)
  process.exit(0)
}

/** Load Playwright from wherever this machine keeps it. */
function loadPlaywright() {
  const direct = [
    join(ROOT, 'node_modules/playwright/index.mjs'),
    join(DSH_REPO, 'node_modules/playwright/index.mjs'),
  ]
  // pnpm keeps the package one level deeper than the store link.
  try {
    const pnpm = join(DSH_REPO, 'node_modules/.pnpm')
    for (const dir of readdirSync(pnpm)) {
      if (!dir.startsWith('playwright@')) continue
      direct.push(join(pnpm, dir, 'node_modules/playwright/index.mjs'))
    }
  } catch { /* no pnpm store here */ }
  return direct.find(candidate => existsSync(candidate)) ?? null
}

/** Newest Chromium that Playwright already downloaded on this machine. */
function findChromium() {
  if (process.env.DSH_CHROMIUM !== undefined) {
    return existsSync(process.env.DSH_CHROMIUM) ? process.env.DSH_CHROMIUM : null
  }
  const cache = join(process.env.HOME ?? '', '.cache/ms-playwright')
  if (!existsSync(cache)) return null
  const builds = readdirSync(cache)
    .filter(dir => /^chromium-\d+$/.test(dir))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const build of builds) {
    const binary = join(cache, build, 'chrome-linux64/chrome')
    if (existsSync(binary)) return binary
  }
  return null
}

/**
 * Pull one injected CSS string out of a compiled client module.
 * The bundles store their styles as a JS string literal, so the quotes and
 * escapes have to be decoded the way the runtime would.
 */
function extractCss(file, marker) {
  const source = readFileSync(file, 'utf8')
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`marker not found in ${file}: ${marker}`)
  const start = source.lastIndexOf('"', at) + 1
  let end = at
  for (;;) {
    end = source.indexOf('"', end)
    let slashes = 0
    for (let i = end - 1; source[i] === '\\'; i -= 1) slashes += 1
    if (slashes % 2 === 0) break
    end += 1
  }
  return JSON.parse(`"${source.slice(start, end)}"`)
}

/** Read the host's compiled sidebar CSS and its class-name prefix. */
function hostSidebar() {
  const file = join(DSH_REPO, 'packages/client/ui-sidebar/lib/client.js')
  if (!existsSync(file)) skip(`no built sidebar at ${file}`)
  const source = readFileSync(file, 'utf8')
  // The prefix keeps its trailing underscore: every class is `${prefix}panelRow`.
  const prefix = (source.match(/\b([A-Za-z0-9_]+_panelList)\b/) ?? [])[1]?.replace(/panelList$/, '')
  if (prefix === undefined) skip('cannot find the sidebar class-name prefix')
  const marker = `.${prefix}root{`
  if (!source.includes(marker)) skip('cannot find the sidebar stylesheet')
  return { css: extractCss(file, marker), prefix }
}

function hostTheme() {
  const file = join(DSH_REPO, 'packages/client/ui-theme/lib/client.js')
  if (!existsSync(file)) skip(`no built theme at ${file}`)
  return extractCss(file, '--dsw-alias-bg-base')
}

/** A minimal stroke glyph, standing in for a panel icon. */
const glyph = c => `<span class="${c}panelGlyph" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="2.5"/></svg></span>`

/** One panel row, in the shape the host renders at the given width. */
const entry = (c, label, wide) => `
      <div class="${c}panelEntry${wide ? ` ${c}panelEntryWide` : ''}">
        <button type="button" class="${c}panelRow" aria-label="${label}">${glyph(c)}${
  wide ? `<span class="${c}panelTitle ${c}wide">${label}</span>` : ''}</button>
        ${wide ? `<button type="button" class="${c}panelUnpin" aria-label="从侧边栏取消固定${label}"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg></button>` : ''}
      </div>`

const more = (c, wide) => `
      <span class="${c}moreAnchor"><button type="button" class="${c}panelRow" aria-label="更多" aria-haspopup="menu">
        ${glyph(c)}${wide ? `<span class="${c}panelTitle ${c}wide">更多</span>` : ''}
      </button></span>`

/** The harness page: host CSS, host DOM, the plugin's real client module. */
function page({ sidebarCss, themeCss, prefix, wide }) {
  const labels = ['插件', '自动化任务', '任务看板', '待办', '资料馆']
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>${themeCss}</style>
<style>${sidebarCss}</style>
<style>body { margin: 0; background: var(--dsw-specific-sidebar-fill); font-family: "Noto Sans CJK SC", sans-serif; }</style>
</head><body data-platform="linux">
<div class="${prefix}root${wide ? '' : ` ${prefix}collapsed`}" style="width:${wide ? 300 : 56}px;height:520px">
  <nav class="${prefix}panelList" aria-label="全局面板">
${labels.map(l => entry(prefix, l, wide)).join('')}
${more(prefix, wide)}
  </nav>
</div>
<script>window.__ModuleLoader__ = { load: def => { window.__mod = def } }</script>
<script>${SOURCE}</script>
<script>
  const dicts = {}
  window.__mod.factory(() => ({})).apply({
    effect: fn => fn(),
    locale: {
      register: (ns, d) => { dicts[ns] = d; return () => {} },
      bind: ns => k => (dicts[ns] ?? {}).zh[k] ?? k,
      getLocale: () => ({ id: 'zh' }),
    },
  })
</script></body></html>`
}

/** Read the geometry the assertions below care about, straight from the page. */
const MEASURE = () => {
  const box = el => {
    const r = el.getBoundingClientRect()
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
  }
  const nav = document.querySelector('nav[aria-label="全局面板"]')
  const toggle = document.querySelector('.iqb-toggle')
  const visibleText = b => [...b.querySelectorAll('span')]
    .some(s => s.textContent.trim() !== '' && getComputedStyle(s).display !== 'none'
      && s.getBoundingClientRect().width > 0)
  return {
    nav: { direction: getComputedStyle(nav).flexDirection, box: box(nav) },
    rows: [...nav.querySelectorAll(':scope > div')].map(wrap => {
      const b = wrap.querySelector('button[aria-label]')
      return {
        label: b.getAttribute('aria-label'),
        hidden: getComputedStyle(wrap).display === 'none',
        box: box(wrap),
        textShown: visibleText(b),
      }
    }),
    more: box(nav.querySelector(':scope > span > button[aria-haspopup]')),
    toggle: { box: box(toggle), textShown: visibleText(toggle) },
  }
}

const checked = []
const check = (name, ok) => { checked.push({ name, ok }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`) }

async function main() {
  const sidebar = hostSidebar()
  const themeCss = hostTheme()
  const playwright = loadPlaywright()
  if (playwright === null) skip('Playwright is not installed')
  const { chromium } = await import(playwright)
  const executable = findChromium()
  if (executable === null) skip('no Chromium build (set DSH_CHROMIUM)')

  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: executable })
  const context = await browser.newContext({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 2 })

  for (const wide of [true, false]) {
    const width = wide ? 'expanded' : 'rail'
    const file = join(OUT, `harness-${width}.html`)
    writeFileSync(file, page({ sidebarCss: sidebar.css, themeCss, prefix: sidebar.prefix, wide }))

    const tab = await context.newPage()
    tab.on('pageerror', error => console.log('  pageerror:', error.message))
    await tab.goto(`file://${file}`)
    await tab.waitForTimeout(250)

    for (const mode of ['icon', 'native']) {
      await tab.evaluate(m => {
        if (m === 'native') document.documentElement.setAttribute('data-iqb-mode', 'native')
        else document.documentElement.removeAttribute('data-iqb-mode')
      }, mode)
      await tab.waitForTimeout(120)
      const m = await tab.evaluate(MEASURE)
      console.log(`\n${width}/${mode}`)
      await tab.screenshot({ path: join(OUT, `${width}-${mode}.png`), clip: { x: 0, y: 0, width: 420, height: 560 } })

      if (mode === 'icon') {
        check(`图标模式下 nav ${wide ? '横排' : '保持窄轨竖排'}`, m.nav.direction === (wide ? 'row' : 'column'))
        if (wide) check('图标模式 nav 收成单行', m.nav.box.h < 48)
        // Built from whatever the host registered: nothing may drop out.
        const kept = m.rows.filter(r => !r.hidden)
        check('图标模式每个注册的面板都在行内', kept.length === m.rows.length)
        check('图标模式含「自动化任务」（曾因白名单被漏掉）',
          kept.some(r => r.label === '自动化任务'))
        check('图标模式行内没有可见文字', wide ? kept.every(r => !r.textShown) && !m.toggle.textShown : !m.toggle.textShown)
        check('图标模式每格是 32px 方块', wide ? kept.every(r => r.box.w === 32 && r.box.h === 32) : true)
        check('图标模式开关在行尾（32px 方块）', wide ? m.toggle.box.w === 32 && m.toggle.box.x > m.more.x : true)
      } else if (wide) {
        // The switch sits at the end of the list, so it has to line up with
        // the rows above it: same left edge, same height, and a caption.
        const row = m.rows[0]
        check('原版模式恢复纵向列表', m.nav.direction === 'column')
        check('原版模式所有面板都在', m.rows.every(r => !r.hidden))
        check('原版模式每行显示文字', m.rows.every(r => r.textShown))
        check('原版模式行高与宿主一致（32px）', m.rows.every(r => r.box.h === 32))
        check('原版模式开关左边缘与行一致', Math.abs(m.toggle.box.x - row.box.x) <= 1)
        check('原版模式开关高度与行一致', m.toggle.box.h === row.box.h)
        check('原版模式开关文字可见', m.toggle.textShown)
      }

      if (!wide) {
        // The rail keeps the host's own stacked glyphs in both modes; the
        // switch has to become one of those 36px columns.
        check('窄轨两种模式都保持纵向', m.nav.direction === 'column')
        check('窄轨不隐藏面板', m.rows.every(r => !r.hidden))
        check('窄轨每格沿用宿主 36px', m.rows.every(r => r.box.w === 36))
        check('窄轨开关是 36px 方块且不出轨', m.toggle.box.w === 36 && !m.toggle.textShown)
        check('窄轨开关与轨道同宽同列', Math.abs(m.toggle.box.x + m.toggle.box.w / 2 - (m.rows[0].box.x + 18)) <= 1)
      }
    }
    await tab.close()
  }

  await browser.close()
  const failures = checked.filter(c => !c.ok)
  console.log(`\nscreenshots: ${OUT}`)
  console.log(`${checked.length - failures.length} passed, ${failures.length} failed`)
  process.exit(failures.length === 0 ? 0 : 1)
}

await main()
