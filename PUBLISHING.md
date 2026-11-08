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

可以打一个预构建包，附到 GitHub Release，并在收录条目里加：

```yaml
tarball: https://github.com/<owner>/dsh-plugin-thinking-level/releases/latest/download/dsh-plugin-thinking-level.tgz
```

打包命令：

```sh
npm pack --pack-destination dist
```

## 当前状态（2026-11-07）

- GitHub 仓库：https://github.com/zmd12345/dsh-plugin-thinking-level
- Release：https://github.com/zmd12345/dsh-plugin-thinking-level/releases（当前 v0.3.4，市场条目固定走 latest）
- 市场收录 PR：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/12826
- npm：尚未发布（需要 `npm login`；不影响收录和 GitHub 安装）
- 当前插件版本：0.3.4（市场条目固定走 `latest/download`，发新版本不用再改条目）
- PR check：Build 步骤失败于上游 `data/screenshots.json` 的两个遗留键（`Ultronen/dsh-archived-chats`、`Ultronen/dsh-liquid-glass`），与本站条目无关；本条目已通过 awesome-lint、README parity、entry-path 检查
- Submission gate：仓库年龄门槛已过，等待自动重跑（旧运行结果尚未刷新）
- 当前状态：等待 gate 自动放行 + 维护者 review / merge，合并后官网与市场索引会自动重建
