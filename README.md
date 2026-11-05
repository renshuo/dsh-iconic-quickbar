# DSH 侧栏图标快捷栏

[![license](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)

把 [DeepSeek Harness](https://github.com/deepseek-ai) 左侧栏**「新建会话」下方**的面板列表，
改成**一行无文字图标按钮**（插件 / 自动化任务 / 任务看板 / 待办 / 资料馆，跟着原本的**「更多」**），
行尾再加一个**模式开关**——不满意随时切回原版。

```
新建会话
[🧩] [⏱] [📋] [✅] [📚] [➕]          [☰]   ← 图标模式
                                     ↑ 开关
```

> 行里有几个图标、都是谁，**完全由宿主注册了哪些面板决定**；
> 装个带侧栏入口的插件，它就自己多一格，不用改本插件。

点开关切回原版（开关变成和上下一致的一行「图标 + 文字」）：

```
新建会话
🧩 插件
⏱ 自动化任务
📋 任务看板
✅ 待办
📚 资料馆
➕ 更多
▦ 图标模式                                  ← 原版模式
```

## 特性

- **纯表现层**：不改宿主代码、不禁用任何插件，每个面板的功能完全不受影响。
- **位置天然正确**：改的就是宿主自己那个面板列表，不在别处另造一条工具栏。
- **模式可切换**：原版列表与图标行一键互换，选择写入 `localStorage`，刷新后保持。
- **不丢入口**：行内的按钮完全由宿主注册了哪些面板决定，插件不写死任何面板名；
  面板增减、改名都不用改配置，新的 launcher 自动出现。
- **图标悬停有名字**：图标模式隐藏了文字，每个图标（含「更多」）会补上一个原生
  tooltip，内容正是被隐藏的原文；切回原版或收起窄轨时自动撤掉，不与宿主自己
  的 tooltip 叠在一起。
- **跟随主题与语言**：用宿主主题令牌 `--dsw-*`，按钮无障碍名走 Client locale 服务。
- **可卸载干净**：样式、开关按钮、tooltip、模式属性都由 `ctx.effect` 的清理函数回收。

## 安装

本插件是 DSH 的 Cordis bundle（客户端半部），通过 profile 的 bundle 机制加载。

### 方式一：从 npm 安装（推荐）

```bash
npm install @renshuo/dsh-iconic-quickbar
```

然后在 DSH 插件面板「安装第三方插件 → npm 包」输入 `@renshuo/dsh-iconic-quickbar`，
或 `plugin_manager` 工具的 `install_bundle`，目标填该包名，最后**刷新页面**。

### 方式二：从源码目录

```bash
git clone https://github.com/renshuo/dsh-iconic-quickbar.git \
  ~/dsh-plugins/dsh-iconic-quickbar
```

在 DSH 中把它安装为 bundle（插件面板的「安装第三方插件 → 本地目录」，
或 `plugin_manager` 的 `install_bundle`，目标填上面这个目录的绝对路径），
最后**刷新页面**。

> 包名带 scope `@renshuo/`，并在 `package.json` 里设置 `publishConfig.access: public`，
> 可直接 `npm publish`。默认 registry 指到 npmmirror；
> 如需发到官方 registry，用 `npm publish --registry=https://registry.npmjs.org`。

## 使用

装好后侧栏自动变成图标行。点行尾的开关在原版/图标模式之间切换。

想调整：

| 想改什么 | 改哪里 |
|---|---|
| 按钮尺寸、间距 | `client.js` `buildCss()` 里的 `width` / `height` / `gap` |
| 开关停靠位置 | `buildCss()` 里 `margin: 0 0 0 auto` 那条规则 |
| 开关图标 | `LIST_GLYPH` / `GRID_GLYPH` |

源码目录即安装目录（profile 里是指向它的软链），改完刷新页面即可生效。

## 工作原理

**直接在宿主原生的面板列表 `<nav>` 上改样式**，而不是另造一条工具栏。
位置、图标、选中高亮、无障碍名称、「更多」按钮全部沿用原生结构，
所以没有禁用任何插件，也没有任何面板失去入口。

模式开关是原版模式的唯一出口，所以两种模式下它都在。
样式按模式门控：`html:not([data-iqb-mode="native"])`——
去掉这个属性，侧栏就 100% 恢复宿主原样。

### 图标 tooltip

宿主把每个面板按钮包在 `<Tooltip label={label} disabled={wide}>` 里：
**展开态禁用**（因为本来就有文字），**收起窄轨启用**。图标模式恰好只作用在展开态，
文字被 CSS 隐掉、宿主的 tooltip 又是关的，于是纯图标没人报名字。

插件给每个行按钮加一个原生 `title`，文本直接读取那个被隐藏的 caption span
（不写死面板名、不猜 `aria-label`，宿主改文案 / 切换语言都会自动跟上）：

| 状态 | 谁在报名字 |
|---|---|
| 展开 + 图标模式 | 插件加的原生 `title`（读 caption 原文） |
| 展开 + 原版模式 | 可见文字；插件撤掉 `title`，避免多余气泡 |
| 收起窄轨 | 宿主自己的主题化 tooltip；插件不加，避免双重气泡 |

`title` 的增删由 `MutationObserver` 兜底：行重渲染、文案原地改写（切语言）、
新面板加入、甚至 `data-iqb-mode` 被外部直接改写，都会重新对齐。
按钮原本自带的 `title` 会被记住，撤掉时原样还原。

### 三条样式规则

| 规则 | 选择器 | 作用 |
|---|---|---|
| 横排 | `nav[aria-label="全局面板"]:has(> div > button > span + span, > button > span + span)` | 只在**展开态**生效 |
| 收窄 | `> div:has(> button)`（新版）/ `> button`（旧版）/ `> span > button[aria-haspopup]` | 32×32 方形居中 |
| 隐藏文字 | 行按钮 `> span + span` | 只留图标，`aria-label` 仍提供名称 |
| 收纳 | —— | 不做收纳：所有注册面板都留在行内，够宽就换行 |

### 两代宿主 DOM 都要覆盖

DSH **0.2.2** 给每行加了一层列表项 `<div>`（行内多了悬停才出现的「取消固定」按钮），
行高也从 36px 收到 32px。旧版是按钮直接挂在 `<nav>` 下：

```
0.2.1 及更早           0.2.2 起
nav                    nav
└── button.panelRow    ├── div.panelEntry
    ├── span(图标)      │   ├── button.panelRow
    └── span(文字)      │   │   ├── span(图标)
                        │   │   └── span(文字)
                        │   └── button.panelUnpin   ← 悬停出现
                        └── span(Menu 锚点) > button[aria-haspopup]
```

所以每条规则都同时覆盖**包裹层**和**裸按钮**两种形态，
展开态判定也改成看「有没有文字 span」而不是看某一种结构。
新增的那个 unpin 按钮必须一起隐掉：32px 方块里放不下它，
它会盖在图标上、把面板的点击变成取消固定。


### 模式开关

槽位系统**没有**任何槽能渲染进面板行内部，所以这个按钮不能走 `ctx.slots.register`。
它是被**直接挂进 `<nav>` 的 DOM**（`appendChild`），配合 `MutationObserver` 兜底：
React 重渲染时可能把它踢掉，观察者发现脱离就重新挂回去。

- `margin-left: auto` → 行内最右；两种模式共用同一个节点，只换图标、文字与 `aria-label`
- **两种模式的呈现差别是刻意的**：
  - 图标模式：又一个 32×32 方按钮，文字由 CSS 隐掉，图标 18px
  - 原版模式：照抄原生行结构（`<span>图标</span><span>文字</span>`），36px 行高、
    `padding: 7px 8px`、图标 16px、文字「图标模式」——夹在一排面板行中间才不突兀
- `aria-label` 描述**点击后的动作**（"切换到原版列表"），可见文字描述**当前提供什么**
  （"图标模式"）；语义不同是故意的
- 选择存 `localStorage`（键 `dsh-iconic-quickbar:mode`）

### 几个踩过的坑

- **`:has()` 而不是宿主类名**：侧栏收起时 `wide=false`、按钮不渲染文字标签，
  用「有没有第二个 span」判断展开态，比猜 `.collapsed` 稳。收起后的 56px 窄轨
  一行放不下这些图标，保持原样竖排。
  注意判定要**排除开关自己**：开关两种形态都带文字 span，
  否则窄轨会因为这个 span 被误判成展开态，一格图标被撑成一整行。
- **「更多」按钮在 `<span>` 里，不是 `<div>`**：宿主 Menu 组件
  （`ui-primitives/src/Menu.tsx`）用 `<span>` 包住 anchor，所以它是
  `nav > span > button[aria-haspopup]`。先写成 `> div > button` 时「更多」的文字
  一直没被隐藏。
- **那个 `<span>` 里同时装着展开的菜单列表**：内层必须钉到触发按钮本身，
  **不能写 `> span button` 这种后代选择器**——否则菜单里每一行的文字会一起消失。
- **多语言逐条展开**：给逗号连接的选择器列表追加 `> button` 只会绑定最后一个，
  前几个会退化成裸 `nav` 选择器。

以上三条都有回归断言锁着（见下）。

## 项目结构

```
dsh-iconic-quickbar/
├── package.json        # bundle 声明：dsh.bundle.patch + dsh.client
├── cordis.patch.yml    # 插入 loader 条目（id: dsh-iconic-quickbar）
├── index.js            # Host 半部，空 apply()（逻辑全在浏览器端）
├── client.js           # 浏览器半部：注入样式 + 挂载模式开关
├── locale/             # zh/en 显示名与描述
│   ├── en.json
│   └── zh.json
├── icon.svg
├── test/
│   ├── dom.test.mjs    # jsdom 行为与回归测试
│   └── visual.mjs      # 用宿主真实 CSS 在 Chromium 里量像素
├── LICENSE
└── README.md
```

## 开发与测试

```bash
npm install        # 安装 jsdom（唯一开发依赖）
npm test           # 231 项断言：两代 DOM × 展开态/窄轨
npm run test:visual  # 像素校验（38 项），截图写到 .debug/
```

`npm test` 把 `client.js` 原样载入 jsdom，并跑**两代宿主 fixture × 两种宽度**四组：

| 维度 | 取值 |
|---|---|
| 面板行形态 | `wrapped`（0.2.2+ 列表项 `<div>` 包裹）/ `flat`（0.2.1 裸按钮） |
| 侧栏宽度 | 展开态（有文字标签）/ 收起窄轨（36px，无标签） |

覆盖：样式门控与逐语言展开、开关挂载与停靠、横排/收窄/隐藏文字、
每个图标的 tooltip（文本取自 caption、宿主原有 title 的还原、unpin 与菜单项
不被误加、窄轨不叠加、原版模式撤除、外部改写模式门控后重对齐）、
菜单项不被误伤、unpin 不被误删面板行、窄轨不被开关文字冒充成展开态、
模式切换的四种反应（属性/标签/图标/localStorage）、原版模式豁免全部布局规则、
宿主重渲染后的重新挂载、卸载清理。

历史 bug 各有回归断言，并已用变异测试确认它们**确实会失败**
（去掉 unpin 隐藏规则、展开态判定退回只看直接子 button、
去掉开关文字隐藏、重新引入面板白名单 —— 每种变异都被抓住）。

`npm run test:visual` 补上 jsdom 量不出的东西：它从**已安装的宿主**里抽出编译后的
侧栏与主题 CSS，重建宿主真实渲染的面板列表 DOM，把 `client.js` 载进 Chromium，
然后量尺寸并截图（38 项断言 + `.debug/*.png`）。
宿主改版导致的行结构变化、行高变化、开关与原版行的对齐偏移，都在这里暴露——
0.2.2 那层列表项 `<div>` 就是这么发现的。缺少 Playwright / Chromium 时它会
打印原因并跳过，不影响 `npm test`。

## 兼容性

- 面向 DSH 的 Web 客户端；`dsh.client.platform = "web"`。
- 依赖宿主侧栏的 `aria-label` 文案与 `nav` 列表的 DOM 结构。
  若宿主改版改动了这两处，先跑 `npm run test:visual` 看是哪条断言变红，
  再更新 `client.js` 顶部的 `PANEL_NAV_LABELS` 与 `buildCss()`。
- 已在 DSH 0.2.1-rc.3（裸按钮形态）与 0.2.2-rc.1（列表项 `<div>` 形态）上验证。
- 使用 `:has()`（现代浏览器均已支持）。

## 已知限制

- 像素验收是在**离线复现页**里做的（宿主编译后的真实 CSS + 真实 DOM 结构），
  不是直接截取自运行的 DSH 窗口，所以整页排版（侧栏与主区域的相对位置）
  仍建议实际扫一眼。
- 图标模式隐藏了行内的「取消固定」按钮（32px 方块放不下它）。
  取消固定仍需切回原版模式操作，这个能力没有丢。

## 许可证

[GPL-3.0-only](./LICENSE)
