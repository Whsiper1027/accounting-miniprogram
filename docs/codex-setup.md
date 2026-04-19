# Codex Auto Setup

## 这套链路的工作原理

这套配置面向当前“微信记账小程序”仓库，目标是把自动协作链路拆成 3 段：

1. 你在手机端或其他 Codex/GPT 入口给仓库下任务。
2. Codex 把改动提交到远端 `codex-auto` 分支。
3. 你的 Mac 本地通过 `launchd` 每 60 秒执行一次 `scripts/codex_runner.sh`，检测 `origin/codex-auto` 是否出现新 commit。

只有检测到新 commit 时，本地 runner 才会：

1. `git fetch origin codex-auto`
2. 切换到本地 `codex-auto` 分支
3. 快进到远端最新 commit
4. 执行固定白名单验证命令
5. 把结果写入日志，便于排查

这条链路主要负责：

- 拉代码
- 对齐到 `codex-auto`
- 执行基础静态校验
- 输出日志

它**不会**替代微信开发者工具的 GUI 预览、真机调试、上传发布。

## 为什么使用 codex-auto 分支

当前配置明确要求 Codex 默认只在 `codex-auto` 分支工作，不直接修改 `main` / `master`。这样做有几个好处：

- 自动改动和你的人工作业隔离
- 本地轮询逻辑只盯一个固定分支，简单稳定
- 即使自动改动有问题，也不会直接污染主分支
- 便于你后续手动 review、挑选、合并

## 本仓库识别结果

当前仓库不是普通 React/Vite/Next 项目，而是**根目录直出的原生微信小程序**：

- 存在 `app.json`
- 存在 `project.config.json`
- 存在 `project.private.config.json`
- 存在 `sitemap.json`
- 存在根目录 `pages/`
- 不存在 `package.json`
- 不存在标准 `npm test` / `npm build` 流程

因此，本仓库当前最适合的固定验证命令不是 `npm test`，而是一个轻量静态检查脚本：

```bash
bash scripts/validate_miniprogram.sh
```

它会做这些最小必要校验：

- 校验核心 JSON 配置文件是否可解析
- 校验 `app.json` 中声明的页面是否真的存在对应 `.js/.wxml/.wxss`
- 校验 `tabBar.pagePath` 是否和 `app.json pages` 保持一致
- 校验 `pages/` 目录下至少有页面目录

这样做的原因是：

- 当前仓库没有现成的自动化测试体系
- 不应该为了自动化链路强行引入重型测试框架
- 这条链路的目标是“最低可用自动拉取 + 基础校验”，不是替代微信开发者工具

## 新增文件说明

- `AGENTS.md`
  用于约束 Codex 在本仓库中的默认行为。

- `scripts/validate_miniprogram.sh`
  当前仓库的固定静态校验命令。

- `scripts/codex_runner.sh`
  本地轮询并执行拉取 + 校验的核心脚本。

- `launchd/com.whisper.codex.runner.plist.example`
  macOS `launchd` 模板文件。

- `bootstrap/setup_local.sh`
  帮你把 runner 和 plist 模板复制到本地用户目录。

## Mac 本地安装步骤

在仓库根目录执行：

```bash
bash bootstrap/setup_local.sh
```

如果你希望安装到自定义目录，例如 `/usr/local/bin` 之外的用户目录，也可以传参：

```bash
bash bootstrap/setup_local.sh "$HOME/bin"
```

脚本会做这些事：

- 把 `scripts/codex_runner.sh` 复制到 `~/bin/codex_runner.sh` 或你指定的目录
- 创建日志目录 `~/Library/Logs/whisper-codex`
- 把 `launchd/com.whisper.codex.runner.plist.example` 复制到 `~/Library/LaunchAgents/com.whisper.codex.runner.plist`

它**不会**自动执行 `launchctl load`。

## 安装后需要手动做的事

编辑这个文件：

`~/Library/LaunchAgents/com.whisper.codex.runner.plist`

把占位符替换成真实值：

- `{{HOME}}`
- `{{USER}}`
- `{{REPO_DIR}}`
- `{{RUNNER_PATH}}`

例如：

- `{{REPO_DIR}}` 替换成当前仓库绝对路径
- `{{RUNNER_PATH}}` 替换成安装后的 `codex_runner.sh` 绝对路径

## launchd 常用命令

加载：

```bash
launchctl load ~/Library/LaunchAgents/com.whisper.codex.runner.plist
```

停止：

```bash
launchctl unload ~/Library/LaunchAgents/com.whisper.codex.runner.plist
```

重载：

```bash
launchctl unload ~/Library/LaunchAgents/com.whisper.codex.runner.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.whisper.codex.runner.plist
```

## 日志位置

默认日志目录：

```text
~/Library/Logs/whisper-codex
```

常见文件：

- `{{USER}}-codex-runner.stdout.log`
- `{{USER}}-codex-runner.stderr.log`
- `accounting-miniprogram.last_commit`

其中 `.last_commit` 用于记录最近一次已成功处理的 commit。

## 常见失败场景和排查方法

### 1. runner 提示远端分支不存在

原因：

- 远端还没有 `codex-auto`

排查：

```bash
git fetch origin
git branch -r
```

确认是否存在 `origin/codex-auto`。

### 2. runner 提示工作区不干净

原因：

- 本地仓库里还有未提交改动

排查：

```bash
git status
```

先清理你自己的改动，再让 runner 继续工作。

### 3. validate_miniprogram.sh 失败

原因通常是：

- `app.json` 语法错误
- `project.config.json` / `sitemap.json` 语法错误
- `app.json` 声明的页面缺少 `.js/.wxml/.wxss`
- `tabBar.pagePath` 和 `app.json pages` 不一致

手动执行：

```bash
bash scripts/validate_miniprogram.sh
```

直接看终端输出即可。

### 4. launchd 没有按预期运行

先检查 plist 是否还保留占位符，或者路径是否写错。

再执行：

```bash
plutil -lint ~/Library/LaunchAgents/com.whisper.codex.runner.plist
```

然后重载：

```bash
launchctl unload ~/Library/LaunchAgents/com.whisper.codex.runner.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.whisper.codex.runner.plist
```

### 5. Mac 下 PATH 不完整，找不到 git/bash/plutil

`scripts/codex_runner.sh` 和 `scripts/validate_miniprogram.sh` 里已经补了常见 macOS PATH：

```text
/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

如果你把 `git` 或其他命令装在非标准目录，需要自行补到 plist 的 `PATH` 里。

## 这套配置不替代微信开发者工具

这套自动链路只负责：

- 自动拉取 `codex-auto`
- 执行基础校验
- 留下日志

它**不等于**：

- 自动打开微信开发者工具 GUI
- 自动真机预览
- 自动上传小程序版本

微信开发者工具仍然是你做可视化预览、真机联调、上传发布的主入口。
