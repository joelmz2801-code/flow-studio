# Flow Studio 🎨

ComfyUI 风格的节点式 AI 视频制作与图片生成工作流网站。

![node-based workflow](https://img.shields.io/badge/workflow-node--based-4285F4) ![react](https://img.shields.io/badge/React-18-61dafb) ![vite](https://img.shields.io/badge/Vite-5-646cff)

## ✨ 功能

- **节点式交互**：从左侧节点库拖入画布，自由连线组合工作流
- **API 配置节点**：自定义 Base URL、API Key、模型名与接口路径（兼容 OpenAI 风格接口及各类中转网关）
- **图片生成节点**：文生图，支持接入参考图集
- **参考图聚合节点**：最多汇聚 4 张参考图，一并作为图片生成的参考依据
- **视频处理节点**：文生视频 / 图生视频（自动轮询异步任务）
- **预览节点**：仅查看结果，不执行任何保存
- **保存文件节点**：将生成结果下载存储到本地

## 🚀 运行

```bash
npm install
npm run dev
```

浏览器会自动打开 `http://localhost:5173`。

## 🔗 典型工作流

```
API 配置 ──────────────┐
参考图 ×N → 参考图聚合 → 图片生成 → 预览
                                  └→ 保存文件
```

1. 在 **API 配置** 节点填入你的 Base URL 与 API Key
2. 上传参考图（可选），接入 **参考图聚合**，再连到 **图片生成**
3. 填写提示词，点击顶部 **▶ 运行工作流**
4. **预览** 节点查看结果；**保存文件** 节点自动下载

## 🛠 技术栈

- React 18 + Vite 5
- [@xyflow/react](https://reactflow.dev/)（React Flow 12）节点画布
- Zustand 状态管理
- 深色玻璃拟态 UI，Google 四色点缀

## 📡 API 兼容性说明

- 图片生成默认 `POST {baseUrl}/v1/images/generations`，请求体 `{ model, prompt, size, n, image? }`
- 视频生成默认 `POST {baseUrl}/v1/videos/generations`；若返回任务 ID，会每 5 秒轮询直至完成
- 响应解析兼容 `data[0].url` / `data[0].b64_json` / chat-completions markdown 图片等常见格式
- 接口路径均可在 API 配置节点内自定义

> ⚠️ 若你的 API 服务不允许浏览器跨域（CORS），请使用支持 CORS 的网关，或自行加一层代理。
