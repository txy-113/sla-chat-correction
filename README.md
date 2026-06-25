# 语伴探游记 AI 正式版（支持国产大模型）

无需 `npm install`，只要 Node.js 可用即可启动。

## 启动

1. 双击 `start.bat`。
2. 第一次会生成 `.env`。
3. 按下面示例配置模型 Key。
4. 再次双击 `start.bat`。
5. 浏览器打开 `http://localhost:3000`。

## 推荐：配置 DeepSeek

把 `.env` 改成：

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=你的DeepSeek API Key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=30000
PORT=3000
```

说明：DeepSeek 提供 OpenAI 兼容的 `chat/completions` 风格接口，本项目会自动调用：

```text
https://api.deepseek.com/chat/completions
```

## 配置豆包 / 火山方舟

豆包通常通过火山方舟的 OpenAI 兼容接口调用。把 `.env` 改成：

```env
LLM_PROVIDER=doubao
LLM_API_KEY=你的火山方舟 API Key
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
LLM_MODEL=你的推理接入点ID，例如 ep-xxxxxxxxxxxxxxxx
LLM_TIMEOUT_MS=30000
PORT=3000
```

注意：豆包这里的 `LLM_MODEL` 通常不是普通模型名，而是你在火山方舟控制台创建的“推理接入点 ID”。

## 配置其他国产 / 中转模型

只要服务兼容 OpenAI `chat/completions`，都可以这样配：

```env
LLM_PROVIDER=compatible
LLM_API_KEY=你的Key
LLM_BASE_URL=https://你的服务地址/v1
LLM_MODEL=你的模型名
LLM_TIMEOUT_MS=30000
PORT=3000
```

## 页面状态

右上角会显示：

- `AI 已连接`：检测到有效 Key，将调用你配置的模型。
- `本地兜底`：没有 Key 或连接失败，使用本地规则继续运行。

也可以访问：

```text
http://localhost:3000/api/status
```

查看当前 Provider、模型和 Base URL。

## 本项目当前能力

- 实时纠错：输入停顿后自动分析。
- 多轮场景：火锅、夜市砍价、地铁、诊所、租房。
- 多邻国式提示：先给引导问题，再给语法关注点，再给留空句框。
- 词块拼句：学生自己组织表达，不直接暴露完整答案。
- 纠错折叠：完整答案放在“查看完整纠错”中，点击才显示。
- AI 失败兜底：模型不可用时仍能用本地规则演示。

## 快速修复：DeepSeek Key 没生效

如果页面仍显示 `本地兜底`，大概率是 `.env` 里还是占位符，或改错文件。

推荐做法：

1. 双击 `configure-deepseek.bat`。
2. 粘贴你的 DeepSeek API Key。
3. 回车后它会自动写入正确的 `.env`。
4. 再双击 `start.bat`。
5. 打开 `http://localhost:3000/api/status` 检查。

成功时应该看到：

```json
"mode": "ai-ready",
"provider": "deepseek",
"model": "deepseek-chat"
```

## 2026-06-25 功能更新

- 新增 `自由语伴聊天` 场景，保留实时纠错、渐进提示和词块辅助。
- 实时纠错停顿从约 0.55 秒延长到约 1.2 秒，避免一句话没输完就刷新。
- 每个关卡的聊天记录、阶段、输入草稿、提示状态会保存在浏览器 `localStorage`。
- 再次点击同一关卡会恢复之前聊天，不再自动清空。
- 关卡标题右侧新增 `重新开始`，可手动清空当前关卡并重新对话。

如果你已经开着旧服务，请先关闭原来的命令行窗口，再重新双击 `start.bat`，否则浏览器可能还在访问旧进程。
