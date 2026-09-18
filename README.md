# Weekly Planner

An Obsidian weekly planner: a seven-column drag-and-drop board with six color themes, a bilingual (English / 中文) interface, habit tracking, time statistics, and optional Markdown archiving.

![version](https://img.shields.io/badge/version-1.1.7-blue) ![minAppVersion](https://img.shields.io/badge/Obsidian-%3E%3D1.4.0-purple)

**English quick start** — copy `manifest.json`, `main.js` and `styles.css` into `<your vault>/.obsidian/plugins/weekly-planner/`, restart Obsidian, then enable **Weekly Planner** under *Settings → Community plugins*. Open the board by clicking the calendar icon in the left ribbon or by running **Open Weekly Planner** from the command palette (`Ctrl+P`) — it does **not** open by itself on startup. Drag task cards between the seven day columns, switch palettes, tick off habits, and optionally archive the week to Markdown. No network access, no telemetry; everything stays inside your vault. MIT licensed.

---

一个 Obsidian 周计划工作台：七列拖拽看板、配色主题切换、中英双语界面、习惯打卡、时长统计与每日小结。界面与交互参考小红书同款「用 AI 做周计划」工作台。

## 功能

- **周视图看板**：周一至周日七列，任务卡可在列间拖拽调整日期
- **任务卡**：分类配色、计划/实际小时数、完成勾选、分类下拉切换
- **统计**：任务总数、已完成数、计划总时长、实际总时长
- **分类时长汇总**：按分类汇总本周计划/实际时长
- **每日图表（Daily Chart）**：当日各分类计划 vs 实际时长条形对比
- **每日记录**：每天一段自由文本小结
- **侧栏管理**：迷你日历（可翻月，高亮当前周期）、本周优先级、本周任务清单、习惯打卡（七天勾选）、任务分类管理
- **6 套配色主题**：马卡龙、莫兰迪、莫奈花园、孟菲斯、洛可可、敦煌 —— 整页联动换肤
- **中英界面切换**：一键切换，随数据持久化
- **多周期**：可建新周期、归档历史周、下拉切回查看
- **JSON 导入导出**：备份与迁移
- **可选 Markdown 归档**：把当前周计划导出成 `.md` 文件写入库内指定目录（见下）

## 安装

### 方式一：手动安装

1. 下载或克隆本仓库
2. 将 `manifest.json`、`main.js`、`styles.css` 三个文件放入：

   ```
   <你的库>/.obsidian/plugins/weekly-planner/
   ```

3. 重启 Obsidian
4. 设置 → 第三方插件 → 已安装插件 → 启用 **Weekly Planner**

### 方式二：从源码构建

本插件为纯 JavaScript 实现，无需编译，`main.js` 即最终产物。

## 使用

- 点击左侧边栏的日历图标，或使用命令面板（`Ctrl+P`）搜索 **Open Weekly Planner** 打开视图
- 另有命令 **Open Weekly Planner in right sidebar**，直接把看板开在右侧栏
- 注意：**插件启动时不会自动打开视图**。需要手动打开一次，之后 Obsidian 会记住这个标签页
- 视图可像普通标签页一样停靠、分屏

## 设置

设置 → 第三方插件 → Weekly Planner 右侧齿轮图标：

| 设置项 | 说明 | 默认值 |
| --- | --- | --- |
| 界面语言 Interface language | 插件界面语言（English / 中文） | 跟随数据，默认 English |
| 默认配色 Default palette | 新建数据时使用的配色主题 | 马卡龙 Macaron |
| 归档文件夹 Archive folder | Markdown 归档文件的保存目录（库内相对路径），留空则写在库根目录 | `Weekly Planner` |
| 文件名格式 Filename template | 归档文件名模板，支持 `{{start}}` `{{end}}` `{{year}}` | `{{start}}` |
| 日期格式 Date format | 归档文件中日期列的显示格式 | `YYYY-MM-DD` |
| 导出含已完成任务 Include completed tasks | 归档时是否包含已完成任务 | 开启 |
| 自动归档 Auto archive | 归档周期时自动写入 Markdown 文件 | 关闭 |
| 显示每日图表 Show daily chart | 是否在日期列显示 Daily Chart 按钮 | 开启 |
| 每周起始日 Week starts on | 一周的第一天（周一 / 周日） | 周一 Monday |
| 启用自动备份 Enable automatic backup | 改动后自动把数据副本写入库内文件夹 | 开启 |
| 备份文件夹 Backup folder | 数据副本保存目录（库内相对路径），**须在 `.obsidian` 之外** | `_weekly-planner-backup` |
| 备份间隔 Backup interval | 两次自动备份之间的最短时间 | 5 分钟 |
| 保留份数 Copies to keep | 超出数量的旧副本自动删除 | 30 |
| 立即备份 / 从备份恢复 | 手动写一份；或从最近 20 份中选一份恢复 | — |

> 归档目录、备份目录若不存在，插件会自动创建。

## 数据存储

- 插件自身数据保存在 `<vault>/.obsidian/plugins/weekly-planner/data.json`
- **自动备份副本**写入库内独立目录（默认 `_weekly-planner-backup`），刻意放在插件目录之外 —— 见下节
- Markdown 归档文件按设置写入库内指定目录，可被 Obsidian 直接检索、链接、纳入每日笔记体系

## 自动备份

**为什么必须放在插件目录之外**：Obsidian 把「已启用插件列表」缓存在内存里。若在 Obsidian 运行期间从外部写入 `community-plugins.json`（脚本安装、手工编辑等），它下一次保存就会用内存状态覆盖这个文件、把新条目摘掉，随后把那个插件目录当孤儿目录删除 —— **`data.json` 连同里面所有任务一起消失**，重新加载时只剩默认配色和英文界面。

`data.json` 待在插件目录里，救不了自己。所以副本写到库内另一处：

```
<vault>/_weekly-planner-backup/wp-2026-09-18_175644354.json
```

行为细节：

- **自动触发**：任何改动（加/删任务、写笔记、勾选、切周…）都会走一次保存，保存后延迟 3 秒写副本；两份副本之间至少间隔「备份间隔」（默认 5 分钟），所以连续打字只产生一份
- **内容没变就不写**：比对内容指纹，不变则跳过，不产生垃圾文件
- **文件名绝不复用**：`wp-` + 毫秒级时间戳；同一毫秒内再写会追加 `_2`、`_3`，一份副本都不会被另一份顶掉
- **自动清理**：只保留最新 N 份（默认 30），更旧的删除
- **空数据不占位**：刚装好、还没有任何任务的默认数据不会生成副本
- **可恢复**：设置面板可列出最近 20 份并一键恢复；**恢复前会先把当前状态备份一份**，选错了用同样方式退回

排序按**文件 mtime**（不是文件名）—— 因为被清理掉的旧文件名会被新副本重新使用，纯按名字排序会把「复用名」误判成最旧。

> 备份目录务必放在 `.obsidian` 之外，否则会和插件目录一起被回滚清掉。

### 真的被回滚掉之后怎么恢复

插件目录被删时 `data.json` 一起没了，`test/install.py` 会按下面的顺序补回来（**只有在缺失时才写，已存在则绝不覆盖**）：

1. **最新的一份库内副本** —— 从 `_weekly-planner-backup` 里按 mtime 取最新且含 `periods` 的 `wp-*.json`，把完整看板恢复回来
2. **种子文件 `data.seed.json`** —— 库里从来没有过副本时（新机器）的兜底，只有空结构与偏好，没有任务

顺序不能反：先取种子会「恢复成功」但得到一个空看板，而旁边就躺着一份完整副本。
`test/recover_test.py` 用一次性假库把这三条路径（最新副本 / 无副本走种子 / 已有数据不动）都测了一遍。

## 开发

```bash
git clone <repo-url>
cd obsidian-weekly-planner
```

修改 `main.js` 后，在库中重新加载插件即可（设置 → 第三方插件 → 关闭再开启，或使用 [Hot Reload](https://github.com/pjeby/hot-reload)）。

### 离线自检（不需要打开 Obsidian）

`test/` 目录下的脚本可在纯命令行下验证插件，改完代码先跑一遍再切回 Obsidian：

```bash
# 1. 运行期自检：桩化 obsidian 模块 + 迷你 DOM，跑 onload / onOpen /
#    设置页 / 归档写入 / 自动备份（写入位置·去重·轮转·恢复）全链路。
#    可传目标目录以直接测试「已部署的那份」
node test/smoke.mjs
node test/smoke.mjs "E:\My obsidian Vault\.obsidian\plugins\weekly-planner"

# 2. 生成样式预览页（真样式 + 真模板 + 样例数据），浏览器直接打开看版式
python test/preview.py
#    -> test/out/preview-wide.html / preview-narrow.html

# 3. 布局探针：在多个宽度下量真实几何，报告每行几列 / 是否被压到换行下限以下；
#    同时模拟一次编辑以验证 save() 链路（含备份钩子）不抛错
#    （排「显示不全 / 格子太小」先跑这个）
python test/probe.py
python test/probe.py 1400 1085 1000 900      # 也可指定宽度

# 4. 分行可达性：确认换行后的第二行能滚到，且 7 列名字齐全
python test/rows.py 1085 1000                # 宽 高

# 5. 出图看版式（宽 高）
python test/shot.py 1085 1000                # -> test/out/wrap-1085.png

# 5b. 分类胶囊行高度：专测「结构性行被 flex 压扁」（探针里也含这条断言）
python test/pillsbug.py
python test/negctl_pills.py                  # 反向对照：证明断言真的会报错

# 6. 从源 HTML 重新生成 styles.css（改设计后保持样式同步）
python test/regen_css.py ../weekly-planner.html styles.css

# 6b. 看用户截图（无 Pillow 也能用）：尺寸 / 色彩结构 / 扫描线
python test/imgsize.py  shot.png
python test/pngmap.py   shot.png
python test/scanline.py
python test/zoomcrops.py                     # 放大渲染，便于复核

# 7. 安装到某个库（会先检查 Obsidian 是否在运行，在跑就拒绝）
python test/install.py "E:\My obsidian Vault"

# 8. 装后校验：逐文件 md5 比对源 ↔ 库
python test/verify_deploy.py "E:\My obsidian Vault"

# 9. data.json 恢复顺序测试（用一次性假库，不动真实库）
python test/recover_test.py
```

### 文件结构

```
weekly-planner/
├── manifest.json     插件元信息
├── main.js           插件主程序（纯 JS，免编译）
├── styles.css        样式（全部作用域收敛在 .wp-app 容器内）
├── versions.json     插件版本 ↔ 最低 Obsidian 版本映射
├── LICENSE           MIT 许可证
├── README.md
├── RELEASE.md        发布到社区插件目录的操作手册
├── data.seed.json    部署兜底种子（仅 test/install.py 使用，非插件运行文件）
└── test/
    ├── smoke.mjs         运行期自检（桩化 obsidian + 迷你 DOM）
    ├── preview.py        生成样式预览页，便于截图比对
    ├── probe.py          布局探针：量每行几列、是否被压到换行下限以下
    ├── rows.py           换行可达性：第二行能否滚到
    ├── hprobe.py         单列高度探针：量每列 top/h/bodyH，查"列被拉高/空白过大"
    ├── shot.py           无头浏览器出图（加 --hide-scrollbars）
    ├── sb.py             同上但保留滚动条，用来确认滚动条真的渲染出来了
    ├── procs.py          Obsidian 进程检测（Python 解析，替代 grep -c）
    ├── state.py          库状态快照（条目数 / 目录清单 / 目标插件明细）
    ├── verify_deploy.py  源 ↔ 库逐文件 md5 比对
    ├── regen_css.py      从源 HTML 重生成 styles.css
    ├── hotcss.py         只替换 CSS 的轻量更新（已被证伪不能绕过回滚，见「注意事项」）
    ├── px.py             截图像素采样：核对渲染出来的背景/配色是否真的对
    ├── pillsbug.py       复现/守住「分类胶囊行被 flex 压扁」（分类行高度断言）
    ├── negctl_pills.py   反向对照：把 .pills 改回可压缩，确认探针真的报错
    ├── negctl_cmdid.py   反向对照：注入违规命令 ID，确认合规断言真的报错
    ├── package.py        构建发布包（dist/ 仓库文件集 + 运行文件 zip）并校验
    ├── recover_test.py   data.json 恢复顺序端到端测试（假库：最新副本/种子/已有数据）
    ├── imgsize.py        只读 PNG 头拿宽高（无需 Pillow，判断截图是整窗还是裁剪）
    ├── pngmap.py         纯标准库解码 PNG，打印粗粒度色彩结构图
    ├── scanline.py       逐行扫描线游程：精确判别「几列/是否被裁剪」
    ├── zoomcrops.py      把用户截图放大渲染，便于人眼/模型复核
    └── install.py        写入目标库并启用（含进程检测 + data.json 恢复/种子兜底）
```

### 响应式行为

原版是照着宽屏桌面窗口设计的（七列各 252px，合计约 1836px）。在 Obsidian 的窗格里这个宽度并不存在。插件不再把七列硬挤成一行（那样每格只剩 ~115px，完全没法看），而是**按可用宽度自动换行**：一行能放下几列就放几列，剩下的折到下一行。

每列有一个**可读宽度下限** `--dayfloor`（默认 240px），低于它就换行，绝不压缩。

| 窗格宽度 | 布局 | 每格宽度 |
| --- | --- | --- |
| ≥ 1400px | 侧栏在左侧竖排；一行 4 列 + 第二行 3 列 | ~290px |
| 1400 → 1250px | 同上，侧栏收窄到 214px 让位给列 | ~270px |
| 1250 → 1000px | 侧栏移到顶部（masonry 多栏卡片流）；**4 + 3 两行** | 246–309px |
| 1000 → 960px | 每行 3 列，3 + 3 + 1 三行 | ~290px |
| ≤ 960px | 每行 2 列，2 + 2 + 2 + 1 四行 | 289–347px |
| ≤ 520px | 每行 1 列，7 行 | 整行宽 |

（实测值取自 `test/probe.py`：1055px 视口 → `perRow=[4,3] minW=251px`；730px → `[2,2,2,1] minW=347px`。任何宽度下 `hScroll=no`。）

> 换行后整体高度会超过窗格，因此主区改为**纵向滚动**，第二行可滚到（不会像早先那样被裁掉）。
> 任何宽度下都**不出现横向滚动**——换行才是保证可读性的手段。

### 周次跳转

工具栏的 `‹ [周次下拉] ›` 用来直接翻到某一周，不必先在「新建周期」里手动建。

- 下拉列出**以本周为基准的前后各 8 周**（共 17 项），每项显示相对说法与日期区间，
  例如「本周 (2026-09-14 ~ 2026-09-20)」。
- 选中一个**尚不存在**的周会即时创建空周期并切过去；已存在且**有任务**的周在标签尾部带 ` ●` 标记，
  方便区分空白周。
- `‹` / `›` 按钮按周前后翻动，效果等同于在下拉里选相邻项。
- 相对说法随界面语言切换（中文「本周 / 上一周 / 3 周前」，英文 `This week / Last week / 3 weeks ago`）。

### 滚动条

主区是唯一滚动容器（`.days` 自身不滚动，避免出现嵌套滚动条——内层滚动条短、先抢走滚轮事件，
还会掩盖「下面还有一行」这个事实）。滚动条常驻可见：

- `scrollbar-gutter: stable` 预留轨道，内容不会因滚动条出现/消失而左右跳动
- 显式设置轨道与滑块样式，不依赖「悬停才浮现」的浮层滚动条
- 日期列高度封顶在 220–360px，一行不会高到把第二行顶出可视区

### 已知行为

- 日期列高度区间为 220–360px：过矮则内容挤成一条，过高则第二行要滚很久

### 布局不变量（改 CSS 前请先读）

主区 `.main` 是**唯一**滚动容器，内部的结构性行**永远不许被压缩**：

| 行 | 规则 | 为什么 |
| --- | --- | --- |
| `.head` / `.stats` / `.pills` | `flex:0 0 auto` | 它们是纵向 flex 的成员，默认 `flex:0 1 auto` 可以被压缩 |
| `.days` | `flex:0 0 auto` | 高度由内容决定，溢出交给 `.main` 滚动 |
| `.main` | `flex:1` + `overflow-y:auto` | 唯一滚动条 |

最容易踩的坑：**给某个行加 `overflow-x:auto` 会让它的自动最小尺寸变成 0**，
于是它成为唯一能被压缩的 flex 成员，独自吃掉全部溢出。
`.pills`（分类胶囊）就中过这一枪 —— 4 张统计卡完好，胶囊行被压成 2px 的彩色细条。
`test/probe.py` 现在会断言 `pills: CRUSHED`，`test/negctl_pills.py` 用来确认这条断言不是瞎的。

## 注意事项

- 样式全部约束在 `.wp-app` 作用域内，不会污染 Obsidian 原生界面
- `isDesktopOnly: false`，桌面端与移动端均可使用（拖拽在移动端需长按）

### 安装 / 更新时的两个坑

1. **安装前请先完全退出 Obsidian。** Obsidian 运行期间会把 `community-plugins.json`
   缓存在内存里；此时从外部写入插件文件与启用列表，会在 Obsidian 下一次保存配置时
   被整体覆盖 —— 表现为「明明装了，重启后插件却不见了」。`test/install.py` 会先检测
   进程并拒绝执行。
2. **`styles.css` 请用 `test/regen_css.py` 从源 HTML 生成，不要手工改。**
   手工改容易漏掉 CSS 变量或误伤高度规则。特别注意源文件的 `html,body{height:100%}`
   在插件里只能作用于容器本身，若扩散到所有后代元素，卡片会被拉伸到整屏高。

## 作者

YanXu

## 许可

[MIT](LICENSE) © 2026 YanXu

## 社区插件规范符合性

本插件已按 [Obsidian 开发者政策](https://docs.obsidian.md/community-directory/developer-policies) 与 [插件提交要求](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins) 自查：

- **不访问网络**：代码中没有 `fetch` / `XMLHttpRequest` / `sendBeacon`，也不加载任何远程资源
- **不含遥测**：不上报任何使用数据
- **无第三方依赖**：整个 `main.js` 里唯一的 `require` 就是 `require("obsidian")`
- **不自我更新**：不安装、不升级自身及其依赖
- **无广告**：界面内不含任何广告位
- **代码未混淆**：`main.js` 是可直接阅读的源码，未压缩、未加密
- **命令 ID 不含插件 ID**：`open` / `open-sidebar` / `backup-now`（Obsidian 会自动补上 `weekly-planner:` 前缀）
- **`isDesktopOnly: false`**：只使用 Web API，桌面端与移动端通用
