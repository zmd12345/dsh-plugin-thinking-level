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

## 2. 发布 npm（2026-11-14 起**不再发布**，见下）

**本插件不发布到 npm。** 核实过的依据：市场站点生成安装命令的代码（上游 `scripts/build-site.mjs:536-539`）是

```js
// prefer a verified npm package, then the declared prebuilt tarball,
// and use Git only when neither is available
function cardCmd(e) {
  return e.npm ? `dsh plugin --profile web add ${e.npm}` : (e.cmdTarball ?? e.cmdGit)
}
```

npm 只是**第一优先级且可选**——`e.npm` 来自 CI 的 `probe-npm.mjs` 探测结果，只有确实发布了 npm 包才有值。本条目声明了 `tarball:` 字段，所以没 npm 包就直接落到 GitHub Release 的 tarball，再没有才用 `github:owner/repo`。

市场详情页（`awesome-dsh-plugin.com/p/zmd12345/dsh-plugin-thinking-level`）实测展示的两条安装命令，都不经过 npm：

```sh
dsh plugin --profile web add "https://github.com/zmd12345/dsh-plugin-thinking-level/releases/download/v0.4.3/dsh-plugin-thinking-level-0.4.3.tgz"
dsh plugin --profile web add github:zmd12345/dsh-plugin-thinking-level
```

tarball 只在 `probe-tarballs.mjs` **确认它 404** 时才会被丢弃、退回 `github:owner/repo`；判定按 tarball URL 精确匹配，条目换新版本时旧判定自动失效（上游 `scripts/build-site.mjs:53-62`）。所以只要 Release 上的包还在，市场安装路径就一直可用。

放弃 npm 的另一个理由是成本：2026-11-14 试发时，npm 的注册与网页登录都受阻——账号未注册，注册页的「我不是机器人」验证直接拦下（提示 IP `85.234.83.116` 被判定为机器人），网页登录会话只有约 7 分钟 TTL。相比之下市场收录和 GitHub 安装都不需要 npm。

如果哪天确实需要 npm 包（下载量统计、或有人想 `npm i -g`），步骤是：

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
- npm：**不发布**（2026-11-14 决定，依据见第 2 节；市场安装与 GitHub 安装都不需要 npm）
- 当前插件版本：0.4.5（已发布：提交 `62dc802` → 推送 main → Release v0.4.5 + tarball 72876 bytes）
- 网络备注：本机 git 直连 github.com:443 会卡在 HTTP/2 协商（`git push` 超时 75s，而同 URL 的 `curl` 只要 0.7s）；2026-11-13 起直连不通，push 需加 `-c http.proxy=http://127.0.0.1:7890`（FlClash）。**push 必须加 `-c http.version=HTTP/1.1`**

### 上游升版 PR 的权限问题（2026-11-13）

市场升版 PR 需要把分支推到自己的 fork `zmd12345/awesome-dsh-plugin`。2026-11-13 推不上去，根因是 GitHub 的 workflow scope 限制：

- 上游 `891b3e3`（2026-11-12）改了 `.github/workflows/build-site.yml`，fork 里还是旧 blob。
- 推一个以 upstream/main 为基的分支，等于改动 workflow 路径，GitHub 对缺 `workflow` scope 的 token 直接拒绝：`refusing to allow an OAuth App to create or update workflow ... without workflow scope`。
- REST API 绕不过：建 commit 成功，但建 ref 时同一个检查生效（404）。对照实验：commit 的 diff 不碰 workflow 路径时，建 ref 正常。
- fork 与上游的历史已分叉（无共同祖先），所以「基于 fork/main 建分支」也不可行——PR 会显示 1367 个文件的差异，且要改的那一行还会冲突。

解法二选一：

1. `gh auth refresh -s workflow` —— 给 token 加上 workflow scope，然后照常 push。
2. 删除 fork 重新 fork —— 新 fork 与上游完全一致，推送不再受限；代价是 fork 里的分支一起消失（都是已合并 PR 的临时分支），且删除后重建有冷却时间。

### v0.4.5 已发布

在 v0.4.4（阈值 0.6 + /compact 文案）之上，加了让宿主配置问题可携带的两样东西：

- `scripts/check-compaction.mjs`：只读扫描 `~/.dsh/profiles` 下各 profile 的 `cordis.patch.yml`，列出「声明了 reasoningEfforts 但没有默认推理档位（reasoning）」的 provider，并给出要补的配置。可用 `npm run check:compaction` 调用（脚本随包发布，GitHub 安装的用户在仓库里直接跑 `node scripts/check-compaction.mjs`）。
- README 新增「宿主配置：默认推理档位」章节，说明压缩失效的根因与修法。README 也是市场详情页的内容，所以这条会随包一起给到其他用户。

已验证：对着修复前的 profile fixture 跑，能准确检出 mplan 与 minimax-api 两个 provider；对着当前 profile 跑，报「全部已配置」。

### 宿主侧修复（非本插件，但与本插件的文案直接相关）

2026-11-11 发现：**DSH 的压缩在 MiniMax 路由上必然失败**（400，`thinking.type=disabled` 不被 MiniMax-M3.1-Flash 允许）。

根因：压缩摘要请求（`dsh-compaction-basic` 的 `summarizeWithLlm`）构造 `options` 时不带 `reasoningEffort`，而 provider profile 又没写默认档位，于是 `dsh-llm-pi-ai` 的 `resolveReasoningLevel(model, options.reasoningEffort ?? profile.reasoning)` 得到 `undefined`，pi-ai 走 `if (!options?.reasoning)` 分支发出 `thinkingEnabled: false`。

修法：给 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `mplan` 和 `minimax-api` 两个 provider 加 `reasoning: medium`（provider 级 `reasoning` 字段是合法的 profile 字段，语义是默认档位）。

验证：profile 改于 22:17:17 → 22:18:32 首次压缩成功（此前 78 次尝试全部 400）→ 上下文占用从 82% 降到 21.8%，一次压掉 585,299 token。

**这个修复在 profile 文件里，不在本插件仓库里**——插件换机器安装不会带上它。若目标机器的 provider 没写 `reasoning` 默认档位，压缩仍会失败。

### v0.4.4 已发布

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

> 实测修正（v0.4.4）：自动压缩的真实触发点是**约 80 万 token（contextWindow 的 80%）**，不是 550K–800K 区间。首次压缩尝试前最后一次调用的 prompt 是 799,260 token，所以 0.75 闸门只有 5 万 token 的缓冲——提醒刚出现自动压缩就接管了。v0.4.4 因此把闸门降到 0.6，留出约 20 万缓冲。

### v0.4.5 市场升版 PR（已执行，供参考）

2026-11-14 实操，绕开了 GitHub 的 workflow scope 限制，**全程走 REST API，不用 git**：

```sh
# 1. 拿到 fork main（重建后的 fork 与上游逐 blob 一致）
forkMain=$(gh api repos/zmd12345/awesome-dsh-plugin/branches/main --jq .commit.sha)

# 2. blob → tree → commit：parent 设为 fork main，tree 用 fork main 的树 + 条目文件替换
#    相对 parent 只差 1 个文件，不碰 .github/workflows/，所以不需要 workflow scope
gh api -X POST repos/zmd12345/awesome-dsh-plugin/git/blobs  --input -
gh api -X POST repos/zmd12345/awesome-dsh-plugin/git/trees   --input -
gh api -X POST repos/zmd12345/awesome-dsh-plugin/git/commits --input -

# 3. 分支 ref：先建在 fork main 上，再 PATCH 移到新 commit
gh api -X POST  repos/zmd12345/awesome-dsh-plugin/git/refs -f ref=refs/heads/<branch> -f sha=$forkMain
gh api -X PATCH repos/zmd12345/awesome-dsh-plugin/git/refs/heads/<branch> -f sha=<new-commit> -f force=true

# 4. 开 PR
gh api -X POST repos/awesome-dsh-plugin/awesome-dsh-plugin/pulls --input -
```

为什么必须重建 fork：上游 `891b3e3`（2026-11-12）改了 `.github/workflows/build-site.yml`，旧 fork 里还是旧 blob。推一个以 upstream/main 为基的分支等于「你改了 workflow 文件」，GitHub 对缺 `workflow` scope 的 token 直接拒绝（`refusing to allow an OAuth App to create or update workflow ... without workflow scope`）。REST API 绕不过：建 commit 成功，但建 ref 时同一个检查生效（404）；对照实验——commit 的 diff 不碰 workflow 路径时，建 ref 正常。重建 fork 后 fork 与上游逐 blob 一致，提交相对 fork main 只差条目那一行，规则自然不触发。

另一条路是给 token 加 `workflow` scope（`gh auth refresh -s workflow`），但**必须在有图形会话的终端里跑**：gh 存 token 进 macOS 钥匙串需要钥匙串 ACL 授权，沙箱进程会拿到 `SecKeychainItemModifyContent: UNIX[Operation not permitted]`。

网络分层（2026-11-14 实测）：`api.github.com` 383ms 稳定，`github.com` 直连超时（3/3），所以推送走 API 比走 git 可靠得多。

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
