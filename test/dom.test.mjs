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
const row = (label, id, wide = true) =>
  `<button aria-label="${label}" id="${id}"><span></span>${wide ? `<span>${label}</span>` : ''}</button>`

/** 0.2.2+ row: the button plus its unpin sibling inside the list-item wrapper. */
const wrappedRow = (label, id, wide = true) => `<div class="panelEntry${wide ? ' panelEntryWide' : ''}" id="w-${id}">
      ${row(label, id, wide)}
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

/** @param {'wrapped'|'flat'} shape @param {boolean} wide */
function fixture(shape, wide) {
  const entry = shape === 'wrapped' ? wrappedRow : (label, id, w = true) => row(label, id, w)
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

    group('图标模式：unpin 不压住图标')
    if (shape === 'wrapped') {
      const unpins = PANELS.map(([, id]) => document.getElementById(`unpin-${id}`)).filter(Boolean)
      check('每个 unpin 按钮都被隐藏', unpins.length === 5 && unpins.every(el => hit(unpinRules, el)))
    }
    check('回归：面板行按钮不会被当成 unpin 隐藏',
      !PANELS.some(([, id]) => hit(unpinRules, document.getElementById(id))))
    check('unpin 规则只钉在列表项里的第二个按钮上',
      unpinRules.every(r => r.sels.every(s => /div > button:last-of-type:not\(:first-of-type\)/.test(s))))

    group('图标模式：收纳需求外的面板')
    const rest = unique(restRules.flatMap(r => matchAll(document, r)))
    const schedules = document.getElementById(shape === 'wrapped' ? 'w-schedules' : 'schedules')
    check('自动化任务被移出行外', rest.includes(schedules))
    check('四个目标面板保留在行内', boxes().every(el => !rest.includes(el)))
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

  group('切回图标模式')
  toggle.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }))
  check('清除 data-iqb-mode', !document.documentElement.hasAttribute('data-iqb-mode'))
  check('横排规则按宽度重新生效', matchAll(document, rowRule).length === (wide ? 1 : 0))
  check('持久化更新回 icon', env.localStorage.getItem('dsh-iconic-quickbar:mode') === 'icon')

  group('宿主重渲染后的重新挂载')
  toggle.remove()
  await new Promise(resolve => setTimeout(resolve, 80))
  check('观察者把它挂回 nav', document.getElementById('nav').lastElementChild.classList.contains('iqb-toggle'))

  group('卸载清理')
  env.effects.forEach(dispose => { if (typeof dispose === 'function') dispose() })
  check('样式表已移除', document.getElementById('dsh-iconic-quickbar-style') === null)
  check('开关已移除', document.querySelector('.iqb-toggle') === null)
  check('模式属性已清除', !document.documentElement.hasAttribute('data-iqb-mode'))
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
