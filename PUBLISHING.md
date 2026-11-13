# 发布到 DSH 插件市场

这个插件已经具备市场收录需要的 `dsh.bundle`、`cordis.patch.yml`、浏览器端 `exports["./client"]`、截图和图标。剩下的步骤需要一个 GitHub 仓库和对应权限。

## 前置事实

- 官方市场（dsh-market / Discover）的条目来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，投稿方式是向它的 `data/plugins/` 加一个 YAML 文件并提 PR。
- 收录要求仓库声明 `dsh.bundle`（本插件已声明），并给仓库加 `dsh-plugin` topic。
- **仓库创建需要满 1 天**才会通过 CI；新仓库当天提交会被拦，但 CI 会自动重跑，第二天通常自己通过。
- npm 包不是收录的硬性要求；但发布到 npm 后市场可以显示下载量，安装也更顺。

## 1. 建 GitHub 仓库并推送

在 GitHub 新建公开仓库 `dsh-plugin-thinking-level`（不要初始化 README），然后在本目录执行：

```sh
node scripts/prepare-release.mjs <你的GitHub用户名>
git init
git add .
git commit -m "feat: thinking level advisor for DSH"
git branch -M main
git remote add origin https://github.com/<你的GitHub用户名>/dsh-plugin-thinking-level.git
git push -u origin main
```

推送后给仓库加 topic：`dsh-plugin`。

## 2. 发布 npm（可选，推荐）

先把 `package.json` 的 `repository` 指回上面的仓库（`prepare-release.mjs` 已做），然后：

```sh
npm login
npm publish --access public
```

## 3. 提交市场收录

Fork [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，把你仓库里的 `market/data/plugins/<owner>__dsh-plugin-thinking-level.yml` 复制到 fork 的同一路径，然后提 PR。

PR 只需要这一个文件；README 由维护者用脚本生成，不要手改。

条目内容：

```yaml
url: https://github.com/<owner>/dsh-plugin-thinking-level
name: <owner>/dsh-plugin-thinking-level
category: usage
description:
  en: Suggests the right thinking level for the current draft and can switch it in one click, so simple tasks avoid overthinking and hard tasks get enough reasoning.
  zh: 根据当前草稿自动建议思考档位并支持一键切换：简单任务不过度思考、节省 token，复杂任务给足推理、减少返工。
icon: https://raw.githubusercontent.com/<owner>/dsh-plugin-thinking-level/main/assets/icon-180.png
```

## 4. 如果不想发 npm

可以打一个预构建包，附到 GitHub Release，并在收录条目里加（**条目必须固定版本号**——维护者合并时会把 latest 改写为当时的具体版本，此后每次发新版都要跟一个只改 tarball 行的升版 PR）：

```yaml
tarball: https://github.com/<owner>/dsh-plugin-thinking-level/releases/download/v0.4.1/dsh-plugin-thinking-level-0.4.1.tgz
```

打包命令：

```sh
npm pack --pack-destination dist
```

## 当前状态（2026-11-13）

- GitHub 仓库：https://github.com/zmd12345/dsh-plugin-thinking-level
- Release：https://github.com/zmd12345/dsh-plugin-thinking-level/releases（最新 **v0.4.3**；v0.4.2 修复 token 触发读取宿主不存在的 `totalTokens` 字段导致恒不触发的问题，总量改为四桶求和）
- 收录 PR #12826 已由维护者 fkysly **合并**（2026-11-09 01:28 UTC+8），条目已进官网与市场索引
- 升版 PR #13673（tarball v0.4.0 → v0.4.2）已**合并**；其 bump 分支 `bump/thinking-level-v0.4.2` 合并后已由 GitHub 删除，下次升版需新建分支
- 升版 PR #14329（tarball v0.4.2 → v0.4.3）已**合并**，市场条目现指向 v0.4.3（已核对上游 main 的条目内容）
- npm：尚未发布（需要 `npm login`；不影响收录和 GitHub 安装）
- 当前插件版本：0.4.4（**本地已改，待发布**）
- 网络备注：本机 git 直连 github.com:443 会卡在 HTTP/2 协商（`git push` 超时 75s，而同 URL 的 `curl` 只要 0.7s）。**push 必须加 `-c http.version=HTTP/1.1`**；系统代理 127.0.0.1:7890 当前未运行

### 宿主侧修复（非本插件，但与本插件的文案直接相关）

2026-11-11 发现：**DSH 的压缩在 MiniMax 路由上必然失败**（400，`thinking.type=disabled` 不被 MiniMax-M3.1-Flash 允许）。

根因：压缩摘要请求（`dsh-compaction-basic` 的 `summarizeWithLlm`）构造 `options` 时不带 `reasoningEffort`，而 provider profile 又没写默认档位，于是 `dsh-llm-pi-ai` 的 `resolveReasoningLevel(model, options.reasoningEffort ?? profile.reasoning)` 得到 `undefined`，pi-ai 走 `if (!options?.reasoning)` 分支发出 `thinkingEnabled: false`。

修法：给 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `mplan` 和 `minimax-api` 两个 provider 加 `reasoning: medium`（provider 级 `reasoning` 字段是合法的 profile 字段，语义是默认档位）。

验证：profile 改于 22:17:17 → 22:18:32 首次压缩成功（此前 78 次尝试全部 400）→ 上下文占用从 82% 降到 21.8%，一次压掉 585,299 token。

**这个修复在 profile 文件里，不在本插件仓库里**——插件换机器安装不会带上它。若目标机器的 provider 没写 `reasoning` 默认档位，压缩仍会失败。

### v0.4.4 待发布

两处改动：

1. **上下文占用闸门 0.75 → 0.6**。实测本机 contextWindow=1M 的路由上，自动压缩在约 80 万 token（80%）触发——闸门若取 0.75，只有 5 万 token 的窗口，提醒刚出现自动压缩就接管了，等于没有前置价值。0.6 留出约 20% 缓冲，此时「压缩历史」和「新开会话」两个选项都还真的可用（前提是压缩本身能用，见上面的宿主侧修复）。
2. **卡片文案修正 `/compact` 的用法**。原文案写「建议先用 /compact 压缩历史后继续」，但 `/compact` 不是一条能直接发送的斜杠命令：输入框里按 `/` 打开指令列表，再选 Compact 才会执行；直接敲 `/compact` 发送会被当成普通消息。改为「可以新开会话接着做，或在输入框按 / 选 Compact 压缩历史后继续」，把两个选项并列——同一任务未完时换会话要重新交代上下文，未必比压缩更划算。

### v0.4.3 已发布

会话过长提醒的触发信号从「累计四桶 token ≥ 5000 万」改为「当前上下文占路由容量 ≥ 75%」。

原口径的问题：累计四桶里 97% 以上是缓存读取，而缓存读取是最便宜的一桶（约 input 的 1/5、output 的 1/20），拿它凑阈值等于用最便宜的东西吓人。同一份数据在两种口径下相差 8.3 倍——一种说该换会话，一种说不用换。而且累计量是单调递增的计数器，反映不出这一轮贵不贵：短会话跑很多轮会误报，长会话轮次不多会漏报。真正决定每轮成本的是当前上下文有多大（每轮都要重发一遍），故改用宿主 `contextPressure` 投影给出的 provider 报告 prompt 大小与路由容量。

同时：

- 卡片不再显示「估算计费约 X」。原 `effective` 用 0.1 折算缓存读，该系数不对应任何真实价格比（真实是 0.2 对 input、0.05 对 output），且把等效 token 标成计费口径不对。改为显示真实数据：当前上下文大小与占容量百分比。
- 区分「换个话题」和「同一件事没做完」。会话提醒只在输入框为空时出现，此时没有草稿可判，故新增 `taskStillOngoing()` 读最近几轮：任务没做完时换会话要重新交代上下文，此时提示先用 `/compact` 压缩历史；明确换话题才直接建议新开会话。

thinking level 部分未改动。切档不影响缓存前缀（effort 走 `output_config`，不进 prompt 前缀）。

阈值 0.75 为经验值，按 contextWindow=1M 与压缩阈值 550K–800K 推得，可在 `lib/client.js` 的 `SESSION_CONTEXT_RATIO_LIMIT` 调整。

### v0.4.3 发布步骤（已执行，供参考）

1. 提交并推送本仓库：

   ```sh
   git add -A && git commit -m "fix: 会话提醒改按当前上下文占用触发"
   git -c http.version=HTTP/1.1 push origin main
   ```

   ⚠️ push 必须带 `-c http.version=HTTP/1.1`。本机 git 直连 github.com:443 会卡在 HTTP/2 协商（`git push` 超时 75 秒，而同一个 URL 的 `curl` 只要 0.7 秒），加上强制 HTTP/1.1 后秒通。

2. 打 Release 并上传 tarball：

   ```sh
   npm pack --pack-destination dist
   gh release create v0.4.3 dist/dsh-plugin-thinking-level-0.4.3.tgz \
     --repo zmd12345/dsh-plugin-thinking-level \
     --title "v0.4.3" \
     --notes "会话提醒改按当前上下文占用触发；卡片显示真实上下文；区分换话题与同任务未完"
   ```

   发完可用 `curl -sSL -o /tmp/v.tgz <tarball-url>` 核对：状态 200、size 与本地一致、包内 `package/package.json` 版本号正确。

3. 提市场升版 PR（条目只改 tarball 一行 + 描述两行）：

   ```sh
   git clone https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
   cd awesome-dsh-plugin
   git checkout -b bump/thinking-level-v0.4.3
   # 把 data/plugins/zmd12345__dsh-plugin-thinking-level.yml 的 tarball 行改成 v0.4.3
   git commit -am "Bump zmd12345/dsh-plugin-thinking-level to v0.4.3"
   git -c http.version=HTTP/1.1 push origin bump/thinking-level-v0.4.3
   gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
     --head bump/thinking-level-v0.4.3 --base main \
     --title "Bump zmd12345/dsh-plugin-thinking-level to v0.4.3"
   ```

   ⚠️ 上游仓库无 push 权限，须推到自己的 fork `zmd12345/awesome-dsh-plugin`，PR 的 `--head` 用 `zmd12345:<branch>`。fork 已在（#13673 就是这么提的）。

   推之前可用上游自己的校验脚本确认条目合法（它会检查 tarball 必须是 https + GitHub releases 宿主 + .tgz，描述必须单行、locale 必须在站点渲染列表内）：

   ```sh
   npm ci && node -e "import('./scripts/lib/entries.mjs').then(m => \
     console.log(m.tarballProblem('<你的 tarball URL>') ?? 'OK'))"
   ```

   维护者合并后重建索引，市场可见版本即为 v0.4.3。

### 市场条目说明

市场条目为固定版本号写法（`tarball` 行写死具体版本），不是 `latest`。发新版后必须跟一个升版 PR 改这一行，否则市场仍指向旧版本。描述行可一并更新（README 由维护者用脚本生成，不要手改上游仓库的 README）。
