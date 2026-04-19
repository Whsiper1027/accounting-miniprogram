# AGENTS

## Branching Rules

- 默认只在 `codex-auto` 分支工作。
- 不直接修改 `main`、`master` 或其他人工维护的主分支。
- 需要开始修改前，先确认当前仓库的真实微信小程序目录和构建方式。

## Change Scope

- 保持最小改动，只解决当前明确任务。
- 不随意重构目录结构。
- 不修改 secrets、CI/CD、部署配置，除非用户明确要求。
- 这是微信记账小程序仓库，修改前先识别真正生效的目录，而不是假设它是普通 Web/Node 项目。

## Project Detection

- 当前仓库的真实小程序目录是仓库根目录。
- 生效文件位于根目录，例如 `app.json`、`app.js`、`app.wxss`、`project.config.json`、`pages/`。
- 当前仓库没有 `package.json`，所以不要默认执行 `npm test`、`npm run build` 或引入重型测试框架。
- 根目录下的 `workspace/` 不是当前主入口，修改前应优先核对根目录小程序文件。

## Required Validation

- 完成修改前必须执行固定验证命令。
- 本仓库当前固定验证命令为：

```bash
bash scripts/validate_miniprogram.sh
```

- 不允许把任意外部输入拼接成新的验证命令执行。
