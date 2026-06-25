# 部署指南：Render / Railway

本项目是零依赖 Node.js Web 服务，部署时不需要安装额外依赖。

## 必须配置的环境变量

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=你的 DeepSeek API Key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=30000
```

不要把 `.env` 上传到 GitHub 或部署包里。

## Render 部署

推荐方式：GitHub 仓库部署。

1. 把 `yuban-ai-product` 文件夹上传到 GitHub 仓库。
2. 打开 Render，创建 `New Web Service`。
3. 连接 GitHub 仓库。
4. 如果仓库根目录就是 `yuban-ai-product`，不用设置 Root Directory；如果不是，Root Directory 填：`yuban-ai-product`。
5. Build Command 留空或填：`npm install --omit=dev`。
6. Start Command 填：`node server.mjs`。
7. Environment Variables 填上面的 DeepSeek 配置。
8. 部署成功后，Render 会给你一个公网 URL。

本项目已包含 `render.yaml`，如果用 Render Blueprint，也可以直接识别部分配置。

## Railway 部署

1. 把 `yuban-ai-product` 文件夹上传到 GitHub 仓库。
2. 打开 Railway，选择 `Deploy from GitHub repo`。
3. 选择仓库。
4. 如果仓库根目录不是 `yuban-ai-product`，设置 Root Directory 为：`yuban-ai-product`。
5. Variables 里添加 DeepSeek 环境变量。
6. 部署配置会读取 `railway.json`，启动命令是：`node server.mjs`。
7. 生成 Public Domain 后即可分享链接。

## 本地部署前检查

```bash
node --check server.mjs
node --check public/app.js
node server.mjs
```

打开：

```text
http://localhost:3000/api/status
```

确认 `provider=deepseek` 且 `mode=ai-ready`。
