/**
 * Behaviour tests for the client half.
 *
 * `client.js` is a browser module: it calls `window.__ModuleLoader__.load` and
 * then only touches the DOM (no React, no services beyond `ctx.locale`), so it
 * can be loaded verbatim into jsdom and exercised for real.
 *
 * The fixture mirrors the host markup the CSS targets, including the details
 * that previously caused bugs:
 *  - the sidebar's panel list is `<nav aria-label="全局面板">`;
 *  - the More trigger is wrapped in the Menu component's `<span>` and that same
 *    span also holds the open menu list, whose row captions must survive;
 *  - the collapsed rail renders the same buttons without a caption span.
 *
 * Run with `npm test` (requires `npm install` for jsdom).
 */

import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const SOURCE = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// ---------------------------------------------------------------- harness

let passed = 0
let failed = 0

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
  console.log(`\n${title}`)
}

/** Split a stylesheet into rules, keeping every selector of a rule group. */
function rules(css) {
  const out = []
  const re = /([^{}]+)\{([^}]*)\}/g
  let match
  while ((match = re.exec(css)) !== null) {
    const body = match[2].trim()
    if (body === '') continue
    const sels = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    out.push({ sels, body })
  }
  return out
}

// ---------------------------------------------------------------- fixture

const FIXTURE = `<!doctype html><html><body>
  <nav aria-label="全局面板" id="nav">
    <button aria-label="插件" id="plugins"><span></span><span>插件</span></button>
    <button aria-label="自动化任务" id="schedules"><span></span><span>自动化任务</span></button>
    <button aria-label="任务看板" id="taskboard"><span></span><span>任务看板</span></button>
    <button aria-label="待办" id="todos"><span></span><span>待办</span></button>
    <button aria-label="资料馆" id="library"><span></span><span>资料馆</span></button>
    <span class="menuRoot" id="moreRoot">
      <button aria-haspopup="menu" aria-label="更多" id="moreTrigger"><span></span><span>更多</span></button>
      <div class="menuList" role="menu">
        <div class="itemWrap">
          <button role="menuitem" id="menuItem"><span></span><span id="menuLabel">自动化任务</span></button>
        </div>
      </div>
    </span>
  </nav>
  <nav aria-label="rail" id="rail">
    <button aria-label="插件" id="railPlugins"><span></span></button>
    <button aria-label="待办" id="railTodos"><span></span></button>
  </nav>
  <nav aria-label="unrelated" id="other">
    <button aria-label="插件" id="otherPlugins"><span></span><span>插件</span></button>
  </nav>
</body></html>`

/** Boot one isolated copy of the plugin against a fresh fixture. */
function boot() {
  const dom = new JSDOM(FIXTURE, { url: 'http://localhost/', pretendToBeVisual: true })
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

// ================================================================ tests

const env = boot()
const { document } = env
const R = env.rules

const rowRule = R.find(r => /flex-direction:\s*row/.test(r.body))
const hideRules = R.filter(r => /display:\s*none/.test(r.body) && !/!important/.test(r.body))
const restRule = R.find(r => /display:\s*none\s*!important/.test(r.body))
const squareRules = R.filter(r => /width:\s*32px/.test(r.body))
const autoRule = R.find(r => /margin:[^;]*\bauto\b/.test(r.body))
const toggle = document.querySelector('.iqb-toggle')

group('样式表')
check('注入了一个 style 元素', env.styles.length === 1)
check('样式表非空', env.css.trim().length > 0)
check('没有残留的 --dsh- 旧令牌', !/--dsh-/.test(env.css))
check('使用真实主题令牌 --dsw-', /--dsw-/.test(env.css))
check('所有布局规则都以 data-iqb-mode 门控',
  [rowRule, restRule, ...squareRules].every(r => r.sels.every(s => /data-iqb-mode="native"/.test(s))))
check('选择器按每种语言逐一展开（不是裸 nav）',
  rowRule.sels.length === 8 && rowRule.sels.every(s => s.startsWith('html:not')))
check('「更多」内层钉在 button[aria-haspopup] 上',
  hideRules.some(r => r.sels.some(s => /span > button\[aria-haspopup\]/.test(s))))
check('没有错误的 > div > button 选择器', !/> div > button/.test(env.css))

group('模式开关挂载')
check('开关已注入到 nav', toggle !== null && toggle.parentElement.id === 'nav')
check('开关是 nav 的最后一个子元素（最右）', document.getElementById('nav').lastElementChild === toggle)
check('开关带自身 class 规则', R.some(r => r.sels.includes('.iqb-toggle')))
check('开关用 margin auto 贴行尾', autoRule !== undefined && matchAll(document, autoRule).includes(toggle))
check('开关有 data-iqb-toggle 标记', toggle.hasAttribute('data-iqb-toggle'))

group('图标模式：横排与收窄')
check('横排规则只命中本 nav', matchAll(document, rowRule).length === 1 && matchAll(document, rowRule)[0].id === 'nav')
check('横排规则跳过收起窄轨', !matchAll(document, rowRule).some(el => el.id === 'rail'))
check('横排规则跳过无关 nav', !matchAll(document, rowRule).some(el => el.id === 'other'))
check('方形规则命中面板按钮', squareRules.some(r => matchAll(document, r).some(el => el.id === 'plugins')))
check('方形规则命中「更多」按钮', squareRules.some(r => matchAll(document, r).some(el => el.id === 'moreTrigger')))
check('窄轨按钮不被套方形样式', !squareRules.some(r => matchAll(document, r).some(el => el.id === 'railPlugins')))

group('图标模式：隐藏文字')
check('面板行文字被隐藏', ['plugins', 'taskboard', 'todos', 'library']
  .every(id => hideRules.flatMap(r => matchAll(document, r)).includes(document.querySelector(`#${id} span + span`))))
check('「更多」文字被隐藏',
  hideRules.flatMap(r => matchAll(document, r)).includes(document.querySelector('#moreTrigger span + span')))
check('窄轨的文字规则不生效（窄轨无文字 span）',
  !hideRules.flatMap(r => matchAll(document, r)).some(el => el.closest('#rail')))
check('回归：菜单项文字不被隐藏',
  !hideRules.flatMap(r => matchAll(document, r)).includes(document.getElementById('menuLabel')))
check('回归：菜单项按钮不被收走',
  !matchAll(document, restRule).includes(document.getElementById('menuItem')))

group('图标模式：收纳需求外的面板')
check('自动化任务被移出行外', matchAll(document, restRule).map(el => el.id).join() === 'schedules')
check('四个目标面板保留在行内',
  ['plugins', 'taskboard', 'todos', 'library'].every(id => !matchAll(document, restRule).some(el => el.id === id)))
check('「更多」不被收走', !matchAll(document, restRule).some(el => el.id === 'moreTrigger'))
check('开关自身不被收走', !matchAll(document, restRule).includes(toggle))

group('默认状态')
check('默认为图标模式（无属性）', !document.documentElement.hasAttribute('data-iqb-mode'))
check('开关提示点击后的动作', toggle.getAttribute('aria-label') === '切换到原版模式')
check('图标模式下开关是 18px 列表图标', toggle.querySelector('svg').getAttribute('width') === '18'
  && toggle.querySelectorAll('line').length === 3)
check('图标模式下仍有 caption 节点（由 CSS 隐藏）', toggle.querySelector('.iqb-toggle-caption') !== null)
check('开关具备原生行结构（两个 span）', toggle.children.length === 2)
check('开关有 glyph span', toggle.querySelector('.iqb-toggle-glyph') !== null)

group('切换到原版模式')
toggle.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }))
check('设置 data-iqb-mode=native', document.documentElement.getAttribute('data-iqb-mode') === 'native')
check('提示改为点击后的动作', toggle.getAttribute('aria-label') === '切换到图标模式')
check('图标换成 16px 网格', toggle.querySelector('svg').getAttribute('width') === '16'
  && toggle.querySelectorAll('rect').length === 4)
check('可见文字为「图标模式」', toggle.querySelector('.iqb-toggle-caption').textContent === '图标模式')
check('原版模式下开关文字不被行文字规则误伤',
  !hideRules.flatMap(r => matchAll(document, r)).includes(toggle.querySelector('.iqb-toggle-caption')))
check('选择已持久化', env.localStorage.getItem('dsh-iconic-quickbar:mode') === 'native')
check('原版模式豁免全部布局规则',
  matchAll(document, rowRule).length === 0 && hideRules.flatMap(r => matchAll(document, r)).length === 0)

group('切回图标模式')
toggle.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }))
check('清除 data-iqb-mode', !document.documentElement.hasAttribute('data-iqb-mode'))
check('横排规则重新生效', matchAll(document, rowRule).length === 1)
check('持久化更新回 icon', env.localStorage.getItem('dsh-iconic-quickbar:mode') === 'icon')

group('宿主重渲染后的重新挂载')
toggle.remove()
check('按钮已被移除', document.querySelector('.iqb-toggle') === null)
await new Promise(resolve => setTimeout(resolve, 80))
check('观察者把它挂回 nav', document.getElementById('nav').lastElementChild.classList.contains('iqb-toggle'))

group('卸载清理')
env.effects.forEach(dispose => { if (typeof dispose === 'function') dispose() })
check('样式表已移除', document.getElementById('dsh-iconic-quickbar-style') === null)
check('开关已移除', document.querySelector('.iqb-toggle') === null)
check('模式属性已清除', !document.documentElement.hasAttribute('data-iqb-mode'))

// ================================================================ summary

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
