# DSH 侧栏图标快捷栏

[![license](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)

把 [DeepSeek Harness](https://github.com/deepseek-ai) 左侧栏**「新建会话」下方**的面板列表，
改成**一行无文字图标按钮**：插件 / 任务看板 / 待办 / 资料馆，跟着原本的**「更多」**，
行尾再加一个**模式开关**——不满意随时切回原版。

```
新建会话
[🧩] [📋] [✅] [📚] [➕]              [☰]   ← 图标模式
                   ↑ 更多(无文字)      ↑ 开关
```

点开关切回原版（开关变成和上下一致的一行「图标 + 文字」）：

```
新建会话
🧩 插件
📋 任务看板
✅ 待办
📚 资料馆
➕ 更多
▦ 图标模式                                  ← 原版模式
```

## 特性

- **纯表现层**：不改宿主代码、不禁用任何插件，四个面板的功能完全不受影响。
- **位置天然正确**：改的就是宿主自己那个面板列表，不在别处另造一条工具栏。
- **模式可切换**：原版列表与图标行一键互换，选择写入 `localStorage`，刷新后保持。
- **不丢入口**：不需要出现在行内的面板（如「自动化任务」）移入「更多」菜单，仍可打开。
- **跟随主题与语言**：用宿主主题令牌 `--dsw-*`，按钮无障碍名走 Client locale 服务。
- **可卸载干净**：样式、开关按钮、模式属性都由 `ctx.effect` 的清理函数回收。

## 安装

本插件是 DSH 的 Cordis bundle（客户端半部），通过 profile 的 bundle 机制加载。

```bash
git clone https://github.com/renshuo/dsh-iconic-quickbar.git \
  ~/dsh-plugins/dsh-iconic-quickbar
```

然后在 DSH 中把它安装为 bundle（插件面板的「安装第三方插件 → 本地目录」，
或 `plugin_manager` 工具的 `install_bundle`，目标填上面这个目录的绝对路径），
最后**刷新页面**。

> 包名带 `@local/` 前缀且 `private: true`，因此不能直接 `npm publish`。
> 若要发布到 npm，请先改成不含 `@local/` 的名字，并同步 `cordis.patch.yml` 里的 `name`。

## 使用

装好后侧栏自动变成图标行。点行尾的开关在原版/图标模式之间切换。

想调整：

| 想改什么 | 改哪里 |
|---|---|
| 保留哪些面板在行内 | `client.js` 的 `KEPT_LABELS` |
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

### 三条样式规则

| 规则 | 选择器 | 作用 |
|---|---|---|
| 横排 | `nav[aria-label="全局面板"]:has(> button > span + span)` | 只在**展开态**生效 |
| 收窄 | 同上 `> button` 与 `> span > button[aria-haspopup]` | 32×32 方形居中 |
| 隐藏文字 | 同上 `> button > span + span` 等 | 只留图标，`aria-label` 仍提供名称 |
| 收纳 | `nav > button:not([aria-haspopup]):not([data-iqb-toggle]):not([aria-label="插件"])…` | 需求外的面板移出行外 |

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
│   └── dom.test.mjs    # jsdom 行为与回归测试
├── LICENSE
└── README.md
```

## 开发与测试

```bash
npm install     # 安装 jsdom（唯一开发依赖）
npm test        # 运行 49 项断言
```

测试把 `client.js` 原样载入 jsdom，并用一份贴近宿主真实结构的 fixture 驱动：
展开态列表、收起窄轨、无关 nav、五个面板、「更多」及其展开的菜单列表。

覆盖：样式门控与逐语言展开、开关挂载与停靠、横排/收窄/隐藏文字/收纳、
菜单项不被误伤、模式切换的四种反应（属性/标签/图标/localStorage）、
原版模式豁免全部布局规则、宿主重渲染后的重新挂载、卸载清理。

这三类历史 bug 各有回归断言，并已验证它们**确实会失败**：
错误的 `> div > button` 选择器、裸后代选择器、去掉开关的收走豁免。

## 兼容性

- 面向 DSH 的 Web 客户端；`dsh.client.platform = "web"`。
- 依赖宿主侧栏的 `aria-label` 文案与 `nav` 列表结构。若宿主改版改动了这两处，
  需同步更新 `client.js` 顶部的 `PANEL_NAV_LABELS` 与 `KEPT_LABELS`。
- 使用 `:has()`（现代浏览器均已支持）。

## 已知限制

- 尚未在真实浏览器中做像素级验收（开发环境无浏览器控制能力）：间距、图标观感、
  窄屏换行位置仍建议实际看一眼。
- 「自动化任务」面板不在本插件收编范围内，保留原生竖排，或从「更多」菜单打开。

## 许可证

[GPL-3.0-only](./LICENSE)
