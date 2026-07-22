# Joel Flow Studio

一个以对话为入口的 AI 创作工作台。把文字对话、图片生成、视频生成、参考图和提示词整理到同一个空间里，减少在多个工具之间反复切换。

## 当前产品

- **对话式创作**：围绕同一个对话持续补充想法，保留上下文和生成记录
- **图片生成**：支持画幅比例、风格预设、参考图和图片下载
- **视频生成**：支持文生视频、图生视频和异步任务轮询
- **多模型选择**：内置可用模型，也支持用户添加兼容 OpenAI 格式的自定义模型
- **提示词灵感库**：收藏、搜索和复用常用提示词
- **账户同步**：使用 Supabase 登录后，同步对话、提示词和模型预设
- **移动端适配**：侧边栏抽屉、底部输入区和触控友好操作

## 技术栈

- React 18 + Vite 5
- Zustand 状态管理
- Supabase Auth、Postgres RLS 与 Realtime
- Cloudflare Pages 部署
- OpenAI-compatible API 格式

## 本地运行

```bash
npm install
npm run dev
```

生产构建与结构检查：

```bash
npm run check:ui
npm run build
```

## 配置

复制 `.env.example`，填写 Supabase 公共配置：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Supabase 数据表和 RLS 初始化脚本见 `supabase-setup.sql`。登录、注册、GitHub OAuth 和现有账户数据共用当前项目配置，不需要重新建库。

## API 兼容

自定义模型预设支持兼容 OpenAI 的接口路径，包括：

- `/v1/chat/completions`
- `/v1/images/generations`
- `/v1/videos`
- `/v1/models`

第三方服务必须允许浏览器跨域，或者通过你自己的安全代理转发。不要把真实 API Key 提交到 Git 仓库。

## 部署

项目当前通过 Cloudflare Pages 从 GitHub 的 `main` 分支构建，构建命令为 `npm run build`，输出目录为 `dist`。GitHub Actions 会在 push 和 Pull Request 时执行 UI 检查与生产构建。

线上地址：[flow-studio-bng.pages.dev](https://flow-studio-bng.pages.dev)
