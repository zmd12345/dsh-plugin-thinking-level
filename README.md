# dsh-plugin-thinking-level

把思考强度花在刀刃上：根据当前任务自动建议 **低 / 中 / 高** 档思考，并在输入框上方提醒；一键切换，简单任务不过度思考，复杂任务不因思考不足而返工。

![提醒卡效果](docs/reminder.png)

> 只提醒，不自动切。判定在本地完成，不联网、不上传草稿。

## 为什么能省 token

- **简单任务用低档**：改文案、翻译、列清单这类直接任务，不需要长链条推理，低档可以减少无效的 reasoning token。
- **复杂任务用高档**：排查、重构、跨端、并发这类任务，思考不足往往导致多轮返工，返工比多思考更贵。
- **只在档位不匹配时提醒**：当前档位已经合适就不打扰，避免提醒本身变成噪声。
- **一键切换**：走 DSH 模型菜单同一个 `selectModel` 接口，不用再打开模型菜单逐项点。

## 行为

只在「这句话要我干活、而且当前档位不合适」时才提醒，两道闸门：

1. **意图闸门**：先判断这句是请求还是陈述。纯描述（“今天宝宝体检完了”“刚才构建失败了”“我觉得这个颜色有点深”）一律沉默；出现「帮我 / 请 / 能不能 / 改成 / 排查 / 为什么 / ？」这类请求信号才会评估。
2. **上下文闸门**：会话已有历史轮次时（`blank === false`），说明你在追问，只有「明显要升档」（分数 ≥ 7）或「明显可以直接降档省钱」才会提醒；子代理会话完全不提醒。

另外：

- 输入框为空、以 `/` 开头的命令、或少于 6 个字符时不提醒。
- 当前档位已经合适时不打扰。
- **项目上下文**：本工作区是三端同仓，提到安卓 / 鸿蒙 / iOS / Flutter / ArkTS / SwiftUI 并且要改动时，会按跨端口径同步规则升一档，理由显示“涉及三端口径同步”。
- 提醒卡会说明理由，例如“涉及重构、排查、根因 · 涉及三端口径同步”。
- 点 **切到 Xhigh / 降到 Low** 会切换当前会话的推理等级；点 **忽略** 后同一段草稿（小改动不超过 30 字）不再出现。
- 同一档位被忽略后，本会话内更苛刻才再提醒：升到高需要分数 ≥ 8、中需要 ≥ 5，降档只提醒一次。

## 判定规则

本地启发式，不调用模型，零网络：

- **意图信号**（先决条件）：帮我、请、麻烦、能不能、看下、改成、修一下、实现、生成、发布、排查、为什么、如何、是不是，或以问号结尾。
- **强信号**：架构、重构、排查、调试、根因、并发、性能、安全、迁移、跨端、协议、算法、实现、开发、插件、集成、兼容、崩溃、报错、异常、数据丢失等。
- **中信号**：修改、新增、修复、检查、测试、接口、字段、配置、评估、验证等。
- **弱信号**：翻译、格式化、改名、文案、列出、颜色、字体、简单、只需要等。
- **结构信号**：文本长度、代码块、堆栈/报错、多个文件路径、多步连接词、多个问号、约束数量。

分数 `>= 6` → 高，`3–5` → 中，`<= 2` → 低；追问时只放行 `>= 7` 或 `<= 1`。关键词和阈值都在 [`lib/client.js`](lib/client.js) 顶部的常量里，按自己的习惯改即可。

## 安装

```sh
dsh plugin --profile desktop add github:zmd12345/dsh-plugin-thinking-level
```

本地开发安装：

```sh
dsh plugin --profile desktop add /path/to/dsh-plugin-thinking-level
```

安装后刷新页面；如果 host 没有热加载到新的 bundle，重启一次 DSH Desktop。

## 隐私与副作用

- 只读取当前输入框草稿，用于本地打分。
- 不发送草稿到任何服务器，不写入文件。
- 只有你点“切换”时，才会调用 DSH 的 `selectModel` 修改当前会话的推理等级。
- 点“忽略”不会修改任何设置。

## 开发与测试

```sh
node test/client.test.mjs
```

测试直接加载 `lib/client.js`，校验 `__ModuleLoader__` 协议、导出、17 条草稿判定和 5 条追问判定（含纯陈述必须沉默）。

## English

Suggests the right thinking level for the current draft and can switch it in one click: simple tasks do not burn tokens on overthinking, hard tasks get enough reasoning to avoid rework. The check is a local heuristic; the draft never leaves your machine. Nothing changes until you click the switch button.

## License

MIT
