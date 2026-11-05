/**
 * Behaviour tests for the client half.
 *
 * `client.js` is a browser module: it calls `window.__ModuleLoader__.load` and
 * then only touches the DOM (no React, no services beyond `ctx.locale`), so it
 * can be loaded verbatim into jsdom and exercised for real.
 *
 * The suite runs against every host markup generation the CSS has to cover,
 * because the panel row changed shape in DSH 0.2.2:
 *  - `wrapped` (>= 0.2.2): each row is a list-item `<div>` wrapping the row
 *    button, and that wrapper carries a hover-revealed unpin button;
 *  - `flat` (<= 0.2.1): the row buttons are direct children of the nav;
 * and against both sidebar widths, since the collapsed rail renders the same
 * nav with no caption spans:
 *  - expanded (the icon row), and collapsed (the 36px rail).
 *
 * Every fixture keeps the details that previously caused bugs:
 *  - the sidebar's panel list is `<nav aria-label="全局面板">`;
 *  - the More trigger is wrapped in the Menu component's `<span>`, and that
 *    same span also holds the open menu list, whose row captions must survive.
 *
 * Run with `npm test` (requires `npm install` for jsdom).
 */

import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const SOURCE = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// ---------------------------------------------------------------- harness

let passed = 0
let failed = 0
/** Reported with each check so a failure names the markup it came from. */
let scope = ''

/** @param {string} name @param {boolean} ok */
function check(name, ok) {
  if (ok) {
    passed += 1
    console.log(`  ok   ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL ${name}`)
  }
}

function group(title) {
  console.log(`\n[${scope}] ${title}`)
}

/**
 * Split a selector list on the commas that separate selectors.
 * Commas inside a functional pseudo-class — `:has(a, b)` in particular — are
 * part of one selector, so nesting depth is tracked instead of splitting blindly.
 */
function splitSelectors(list) {
  const out = []
  let depth = 0
  let current = ''
  for (const char of list) {
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  out.push(current.trim())
  return out.filter(Boolean)
}

/** Split a stylesheet into rules, keeping every selector of a rule group. */
function rules(css) {
  const out = []
  const re = /([^{}]+)\{([^}]*)\}/g
  let match
  while ((match = re.exec(css)) !== null) {
    const body = match[2].trim()
    if (body === '') continue
    out.push({ sels: splitSelectors(match[1]), body })
  }
  return out
}

// ---------------------------------------------------------------- fixtures

/** Row button: `wide` adds the caption span the host renders only expanded. */
const row = (label, id, wide = true, title = '') =>
  `<button aria-label="${label}" id="${id}"${title ? ` title="${title}"` : ''}><span></span>${wide ? `<span>${label}</span>` : ''}</button>`

/** 0.2.2+ row: the button plus its unpin sibling inside the list-item wrapper. */
const wrappedRow = (label, id, wide = true, title = '') => `<div class="panelEntry${wide ? ' panelEntryWide' : ''}" id="w-${id}">
      ${row(label, id, wide, title)}
      ${wide ? `<button aria-label="从侧边栏取消固定${label}" id="unpin-${id}"><svg></svg></button>` : ''}
    </div>`

const moreBlock = wide => `<span class="moreAnchor" id="moreRoot">
      <button aria-haspopup="menu" aria-label="更多" id="moreTrigger"><span></span>${wide ? '<span>更多</span>' : ''}</button>
      <div class="moreList" role="menu">
        <div class="itemWrap">
          <button role="menuitem" id="menuItem"><span></span><span id="menuLabel">自动化任务</span></button>
        </div>
      </div>
    </span>`

/** Panels the plugin keeps in the row, plus one it must move into More. */
const PANELS = [
  ['插件', 'plugins'],
  ['自动化任务', 'schedules'],
  ['任务看板', 'taskboard'],
  ['待办', 'todos'],
  ['资料馆', 'library'],
]

/** A host-provided title on one row: replacing it must not lose it. */
const HOST_TITLE = '资料馆（宿主提示）'

/** @param {'wrapped'|'flat'} shape @param {boolean} wide */
function fixture(shape, wide) {
  const entry = shape === 'wrapped'
    ? (label, id, w) => wrappedRow(label, id, w, id === 'library' ? HOST_TITLE : '')
    : (label, id, w) => row(label, id, w, id === 'library' ? HOST_TITLE : '')
  const rows = PANELS.map(([label, id]) => entry(label, id, wide)).join('\n    ')
  return `<!doctype html><html><body>
  <nav aria-label="全局面板" id="nav">
    ${rows}
    ${moreBlock(wide)}
  </nav>
</body></html>`
}

/** Boot one isolated copy of the plugin against a fresh fixture. */
function boot(fixtureHtml) {
  const dom = new JSDOM(fixtureHtml, { url: 'http://localhost/', pretendToBeVisual: true })
  const { window } = dom
  const { document } = window

  const styles = []
  const appendChild = document.head.appendChild.bind(document.head)
  document.head.appendChild = el => {
    if (el.tagName === 'STYLE') styles.push(el)
    return appendChild(el)
  }

  const storage = new Map()
  const localStorage = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
  }

  let captured = null
  window.__ModuleLoader__ = { load: def => { captured = def } }
  new Function(
    'window', 'document', 'localStorage', 'MutationObserver', 'requestAnimationFrame',
    SOURCE,
  )(window, document, localStorage, window.MutationObserver, window.requestAnimationFrame.bind(window))

  const dicts = {}
  const effects = []
  const ctx = {
    effect: fn => {
      const dispose = fn()
      effects.push(dispose)
      return dispose
    },
    locale: {
      register: (ns, d) => { dicts[ns] = d; return () => { delete dicts[ns] } },
      bind: ns => key => (dicts[ns] ?? {}).zh[key] ?? key,
      getLocale: () => ({ id: 'zh' }),
    },
  }

  const plugin = captured.factory(() => ({}))
  plugin.apply(ctx)

  const css = styles.length > 0 ? styles[0].textContent.replace(/\/\*[\s\S]*?\*\//g, '') : ''
  return { dom, window, document, ctx, effects, plugin, css, rules: rules(css), styles, localStorage }
}

const q = (document, sel) => [...document.querySelectorAll(sel)]
const matchAll = (document, rule) => rule.sels.flatMap(sel => q(document, sel))
const unique = list => [...new Set(list)]

// ================================================================ invariants

/** Rules whose effect is the same in every fixture; checked once. */
function stylesheetSuite() {
  scope = 'stylesheet'
  const env = boot(fixture('wrapped', true))
  const R = env.rules
  const css = env.css
  const rowRule = R.find(r => /flex-direction:\s*row/.test(r.body))
  const squareRules = R.filter(r => /width:\s*32px/.test(r.body))

  group('样式表')
  check('注入了一个 style 元素', env.styles.length === 1)
  check('样式表非空', css.trim().length > 0)
  check('--dsh- 只用作宿主侧栏变量，且都带兜底', (() => {
    const used = [...new Set(css.match(/--dsh-[a-z-]+/g) ?? [])]
    const allowed = ['--dsh-sidebar-label-gap', '--dsh-sidebar-paint-inset']
    return used.every(name => allowed.includes(name))
      && (css.match(/var\(--dsh-[^)]*\)/g) ?? []).every(v => v.includes(','))
  })())
  check('使用真实主题令牌 --dsw-', /--dsw-/.test(css))
  check('没有引用宿主的哈希类名（跨版本稳定）', !/_[a-z]+_[a-z]/i.test(css))
  check('所有布局规则都以 data-iqb-mode 门控',
    [rowRule, ...squareRules].every(r => r.sels.every(s => /data-iqb-mode="native"/.test(s))))
  check('选择器按每种语言逐一展开（不是裸 nav）',
    rowRule.sels.length === 8 && rowRule.sels.every(s => s.startsWith('html:not')))
  check('没有裸的后代选择器（会误伤菜单行文字）', !/[a-z\]=] button[ ,{]/.test(css))
  check('样式表里没有任何面板名（不留白名单）',
    !PANELS.some(([label]) => css.includes(`aria-label="${label}"`)))
  check('只留一条 display:none !important（unpin），没有收纳规则',
    (css.match(/display:\s*none\s*!important/g) ?? []).length === 1)
  check('没有 !important 之外的重量级覆盖', (css.match(/!important/g) ?? []).length <= 4)
  env.effects.forEach(dispose => { if (typeof dispose === 'function') dispose() })
}

// ================================================================ per-fixture

/** @param {string} kind @param {'wrapped'|'flat'} shape @param {boolean} wide */
async function suite(kind, shape, wide) {
  scope = kind
  const env = boot(fixture(shape, wide))
  const { document } = env
  const R = env.rules

  // The element that must become a square: 0.2.2's list-item wrapper, or the
  // row button itself on earlier builds.
  const boxes = () => PANELS.slice(0, 1).concat(PANELS.slice(2))
    .map(([, id]) => document.getElementById(shape === 'wrapped' ? `w-${id}` : id))
    .filter(Boolean)
    .filter(el => el.id !== 'w-schedules')

  const rowRule = R.find(r => /flex-direction:\s*row/.test(r.body))
  const captionRules = R.filter(r => /display:\s*none/.test(r.body) && !/!important/.test(r.body))
  const unpinRules = R.filter(r => /display:\s*none\s*!important/.test(r.body) && r.sels.some(s => /last-of-type/.test(s)))
  const restRules = R.filter(r => /display:\s*none\s*!important/.test(r.body) && !unpinRules.includes(r))
  const squareRules = R.filter(r => /width:\s*32px/.test(r.body))
  const narrowRules = R.filter(r => /width:\s*36px/.test(r.body))
  const autoRule = R.find(r => /margin:[^;]*\bauto\b/.test(r.body))
  const toggle = document.querySelector('#nav > .iqb-toggle')
  const hit = (rules, el) => el != null && rules.some(r => matchAll(document, r).includes(el))
  const captions = () => unique(captionRules.flatMap(r => matchAll(document, r)))
  /** Every button carrying one of our tooltips, keyed by its title text. */
  const tipped = () => q(document, '[data-iqb-tip]')
  const tipOf = id => document.getElementById(id)?.getAttribute('title') ?? null
  const tipCount = () => tipped().length

  group('模式开关挂载')
  check('开关已注入到 nav', toggle !== null && toggle.parentElement.id === 'nav')
  check('开关是 nav 的最后一个子元素（最右）', document.getElementById('nav').lastElementChild === toggle)
  check('开关带自身 class 规则', R.some(r => r.sels.includes('.iqb-toggle')))
  check('开关有 data-iqb-toggle 标记', toggle.hasAttribute('data-iqb-toggle'))
  check('开关具备原生行结构（glyph + caption 两个 span）', toggle.children.length === 2
    && toggle.querySelector('.iqb-toggle-glyph') !== null
    && toggle.querySelector('.iqb-toggle-caption') !== null)

  if (wide) {
    group('图标模式：横排')
    check('横排规则命中本 nav', matchAll(document, rowRule).length === 1)
    check('开关用 margin auto 贴行尾', autoRule !== undefined && matchAll(document, autoRule).includes(toggle))
    check('方形规则命中每个保留的面板行', boxes().length === 4 && boxes().every(el => hit(squareRules, el)))
    check('方形规则命中「更多」按钮', hit(squareRules, document.getElementById('moreTrigger')))
    check('方形规则没有碰「更多」的包裹 span', !hit(squareRules, document.getElementById('moreRoot')))
    check('方形规则没有碰菜单列表', !hit(squareRules, document.querySelector('.moreList')))
    if (shape === 'wrapped') {
      const inner = document.getElementById('plugins')
      check('包裹层里的按钮铺满方块', R.some(r => /width:\s*100%/.test(r.body) && matchAll(document, r).includes(inner)))
    }

    group('图标模式：隐藏文字')
    check('面板行文字被隐藏', PANELS.every(([, id]) =>
      captions().includes(document.querySelector(`#${id} span + span`))))
    check('「更多」文字被隐藏', captions().includes(document.querySelector('#moreTrigger span + span')))
    check('开关自己的文字由专属规则隐藏', captions().includes(toggle.querySelector('.iqb-toggle-caption')))
    check('回归：菜单项文字不被隐藏', !captions().includes(document.getElementById('menuLabel')))

    group('图标模式：每个图标都有 tooltip')
    check('五个面板图标都带原生 title', PANELS.every(([label, id]) => tipOf(id) === label))
    check('「更多」图标带 title「更多」', tipOf('moreTrigger') === '更多')
    check('title 文本取自被隐藏的 caption（不是 aria-label 猜的）',
      tipOf('plugins') === document.querySelector('#plugins span + span').textContent.trim())
    check('宿主原有的 title 被记住（可还原）',
      document.getElementById('library').getAttribute('data-iqb-tip-prev') === HOST_TITLE)
    check('全部图标都打了我们的标记', tipped().length === 6
      && PANELS.every(([, id]) => tipped().includes(document.getElementById(id)))
      && tipped().includes(document.getElementById('moreTrigger')))
    check('回归：unpin 按钮没有 tooltip',
      (shape === 'wrapped' ? PANELS.map(([, id]) => `unpin-${id}`) : [])
        .every(id => !tipped().includes(document.getElementById(id))))
    check('回归：菜单项按钮没有 tooltip',
      !tipped().includes(document.getElementById('menuItem')))
    check('回归：开关自身不带我们的 tooltip 标记',
      !toggle.hasAttribute('data-iqb-tip') && toggle.getAttribute('title') === '切换到原版模式')

    group('图标模式：unpin 不压住图标')
    if (shape === 'wrapped') {
      const unpins = PANELS.map(([, id]) => document.getElementById(`unpin-${id}`)).filter(Boolean)
      check('每个 unpin 按钮都被隐藏', unpins.length === 5 && unpins.every(el => hit(unpinRules, el)))
    }
    check('回归：面板行按钮不会被当成 unpin 隐藏',
      !PANELS.some(([, id]) => hit(unpinRules, document.getElementById(id))))
    check('unpin 规则只钉在列表项里的第二个按钮上',
      unpinRules.every(r => r.sels.every(s => /div > button:last-of-type:not\(:first-of-type\)/.test(s))))

    group('图标模式：每个面板都留在行内')
    // The row is built from whatever the host registered. The old version kept
    // a hardcoded allow-list and pushed the rest into More, so a panel missing
    // from that list silently vanished from the row — 自动化任务 did.
    const rest = unique(restRules.flatMap(r => matchAll(document, r)))
    check('没有任何面板被移出行外', rest.length === 0)
    check('自动化任务（不在旧白名单里）也在行内',
      !rest.includes(document.getElementById(shape === 'wrapped' ? 'w-schedules' : 'schedules')))
    check('五个面板全部保留在行内', boxes().length === 4
      && boxes().every(el => !rest.includes(el))
      && !rest.includes(document.getElementById(shape === 'wrapped' ? 'w-schedules' : 'schedules')))
    check('「更多」不被收走', !rest.includes(document.getElementById('moreTrigger')))
    check('开关自身不被收走', !rest.includes(toggle))
    check('回归：菜单项按钮不被收走', !rest.includes(document.getElementById('menuItem')))
    check('回归：菜单行本身不被收走', !rest.includes(document.querySelector('.itemWrap')))
  } else {
    group('收起窄轨')
    check('窄轨不套横排规则（会挤成一排）', matchAll(document, rowRule).length === 0)
    check('窄轨不隐藏行内任何元素', captions().filter(el => el !== toggle.querySelector('.iqb-toggle-caption')).length === 0)
    check('窄轨开关收成 36px 方块', hit(narrowRules, toggle))
    check('窄轨开关隐藏自己的文字', captions().includes(toggle.querySelector('.iqb-toggle-caption')))
    check('窄轨开关不用 margin auto（会顶出轨道）',
      !(autoRule !== undefined && matchAll(document, autoRule).includes(toggle)))
    check('开关的文字不会被误判成「展开态」', document.querySelector('#nav > .iqb-toggle') !== null
      && matchAll(document, rowRule).length === 0)

    group('收起窄轨：不叠加原生 tooltip')
    // The host's own Tooltip stays enabled in the rail; adding a native title
    // there would show two bubbles, and the rail renders no caption to read.
    check('窄轨没有任何图标被我们加 tooltip', tipCount() === 0)
    check('窄轨不改动按钮原有的 title', tipOf('library') === HOST_TITLE)
    check('窄轨其余面板 / 「更多」仍没有 title',
      PANELS.filter(([, id]) => id !== 'library').every(([, id]) => tipOf(id) === null)
      && tipOf('moreTrigger') === null)
  }

  group('默认状态')
  check('默认为图标模式（无属性）', !document.documentElement.hasAttribute('data-iqb-mode'))
  check('开关提示点击后的动作', toggle.getAttribute('aria-label') === '切换到原版模式')
  check('图标模式下开关是 18px 列表图标', toggle.querySelector('svg').getAttribute('width') === '18'
    && toggle.querySelectorAll('line').length === 3)

  group('切换到原版模式')
  toggle.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }))
  check('设置 data-iqb-mode=native', document.documentElement.getAttribute('data-iqb-mode') === 'native')
  check('提示改为点击后的动作', toggle.getAttribute('aria-label') === '切换到图标模式')
  check('图标换成 16px 网格', toggle.querySelector('svg').getAttribute('width') === '16'
    && toggle.querySelectorAll('rect').length === 4)
  check('可见文字为「图标模式」', toggle.querySelector('.iqb-toggle-caption').textContent === '图标模式')
  check('选择已持久化', env.localStorage.getItem('dsh-iconic-quickbar:mode') === 'native')
  check('原版模式豁免全部门控规则', R.filter(r => /data-iqb-mode="native"/.test(r.sels.join(',')))
    .every(r => matchAll(document, r).length === 0))
  check('回归：原版模式下 unpin 按钮恢复可用', unpinRules.every(r => matchAll(document, r).length === 0))
  check('回归：原版模式下所有面板都回到列表',
    restRules.every(r => matchAll(document, r).length === 0))
  check('回归：原版模式下开关不被方形规则压成 32px', !hit(squareRules, toggle))

  group('原版模式：移除图标 tooltip')
  // Captions are visible again, so a native title would be redundant noise.
  check('图标 tooltip 全部移除（标记清空）', tipCount() === 0)
  check('面板按钮不再有我们加的 title', PANELS.every(([, id]) =>
    !document.getElementById(id).hasAttribute('data-iqb-tip')))
  check('宿主原有的 title 被原样还原', tipOf('library') === HOST_TITLE)
  check('没有 title 的面板按钮保持没有 title',
    PANELS.filter(([, id]) => id !== 'library').every(([, id]) => tipOf(id) === null))
  check('「更多」不再有我们加的 title', !document.getElementById('moreTrigger').hasAttribute('title'))

  group('切回图标模式')
  toggle.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }))
  check('清除 data-iqb-mode', !document.documentElement.hasAttribute('data-iqb-mode'))
  check('横排规则按宽度重新生效', matchAll(document, rowRule).length === (wide ? 1 : 0))
  check('持久化更新回 icon', env.localStorage.getItem('dsh-iconic-quickbar:mode') === 'icon')
  check('切回图标模式后 tooltip 重新出现', wide
    ? (PANELS.every(([label, id]) => tipOf(id) === label) && tipOf('moreTrigger') === '更多')
    : tipCount() === 0)

  group('外部直接改 data-iqb-mode（不经过开关点击）')
  // The stylesheet reacts to the attribute, so tooltip state must too — the
  // pixel harness switches modes this way, and a host could as well.
  document.documentElement.setAttribute('data-iqb-mode', 'native')
  await new Promise(resolve => setTimeout(resolve, 80))
  check('外部切到原版：tooltip 随之撤掉', tipCount() === 0)
  check('外部切到原版：宿主原有 title 被还原', tipOf('library') === HOST_TITLE)
  document.documentElement.removeAttribute('data-iqb-mode')
  await new Promise(resolve => setTimeout(resolve, 80))
  check('外部切回图标：tooltip 随之恢复', wide
    ? (PANELS.every(([label, id]) => tipOf(id) === label) && tipOf('moreTrigger') === '更多')
    : tipCount() === 0)

  group('宿主重渲染 / 文案变化后的 tooltip')
  toggle.remove()
  await new Promise(resolve => setTimeout(resolve, 80))
  check('观察者把它挂回 nav', document.getElementById('nav').lastElementChild.classList.contains('iqb-toggle'))
  if (wide) {
    // A locale switch rewrites the caption text in place: characterData
    // observation must re-title the icon from the new text. (nodeValue edits
    // the existing text node; textContent would only fire a childList record.)
    const caption = document.querySelector('#plugins span + span')
    caption.firstChild.nodeValue = 'Plugins'
    await new Promise(resolve => setTimeout(resolve, 80))
    check('caption 文案变化后 tooltip 跟着更新', tipOf('plugins') === 'Plugins')
    // A freshly host-registered panel (new row adopted into the nav) must be
    // named too — the whole point of not hard-coding a panel list.
    const fresh = document.createElement('button')
    fresh.id = 'fresh'
    fresh.setAttribute('aria-label', '新面板')
    fresh.innerHTML = '<span></span><span>新面板</span>'
    document.getElementById('nav').appendChild(fresh)
    await new Promise(resolve => setTimeout(resolve, 80))
    check('新加入的面板图标也自动带上 tooltip', tipOf('fresh') === '新面板')
  } else {
    check('窄轨重渲染后依旧不叠加 tooltip', tipCount() === 0)
  }

  group('卸载清理')
  env.effects.forEach(dispose => { if (typeof dispose === 'function') dispose() })
  check('样式表已移除', document.getElementById('dsh-iconic-quickbar-style') === null)
  check('开关已移除', document.querySelector('.iqb-toggle') === null)
  check('模式属性已清除', !document.documentElement.hasAttribute('data-iqb-mode'))
  check('卸载后所有 tooltip 标记清空', tipCount() === 0)
  check('卸载后宿主原有的 title 被还原', tipOf('library') === HOST_TITLE)
}

// ================================================================ tests

stylesheetSuite()
for (const shape of ['wrapped', 'flat']) {
  await suite(`${shape}/expanded`, shape, true)
  await suite(`${shape}/collapsed`, shape, false)
}

// ================================================================ summary

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
