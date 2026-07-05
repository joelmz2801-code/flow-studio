# Flow Studio 部署指南：Cloudflare Pages + Supabase

> 目标：把 `flow-studio` 部署到 Cloudflare 全球边缘网络，并用 Supabase 提供数据库（云端保存工作流、存储生成的图片、可选用户登录）。

---

## 架构总览

```
用户浏览器
   │
   ├─► Cloudflare Pages   （托管前端静态站点，全球 CDN）
   │
   ├─► Supabase           （Postgres 数据库 + Storage 图片存储 + Auth 登录）
   │
   └─► 你的 AI API        （图片/视频生成，Base URL 在节点里自定义）
```

---

## 第一部分：Cloudflare Pages 部署（约 5 分钟）

### 1. 登录 Cloudflare
- 打开 [dash.cloudflare.com](https://dash.cloudflare.com)，注册/登录（免费套餐足够）。

### 2. 创建 Pages 项目
1. 左侧菜单 → **Workers & Pages** → **Create** → 选 **Pages** 标签
2. 点 **Connect to Git** → 授权 GitHub → 选择 `joelmz2801-code/flow-studio` 仓库

### 3. 构建配置（关键）
| 配置项 | 值 |
|---|---|
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |

### 4. 部署
- 点 **Save and Deploy**，等 1~2 分钟构建完成
- 你会得到一个 `https://flow-studio-xxx.pages.dev` 的地址，全球可访问 🎉
- 以后每次 `git push` 到 `main`，Cloudflare 会**自动重新部署**

### 5.（可选）绑定自己的域名
- Pages 项目 → **Custom domains** → **Set up a custom domain**
- 如果域名托管在 Cloudflare，一键完成；否则按提示加一条 CNAME 记录

---

## 第二部分：Supabase 数据库设置（约 10 分钟）

### 1. 创建项目
1. 打开 [supabase.com](https://supabase.com) → **New project**
2. 填项目名（如 `flow-studio`）、设置数据库密码、选区域（推荐 `Southeast Asia (Singapore)`，离你近）
3. 等待约 2 分钟初始化

### 2. 创建数据表
进入 **SQL Editor**，粘贴运行：

```sql
-- 工作流保存表
create table public.workflows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '未命名工作流',
  graph       jsonb not null,              -- 节点和连线的完整 JSON
  user_id     uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 生成记录表（图片/视频的历史）
create table public.generations (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid references public.workflows(id) on delete set null,
  type         text check (type in ('image','video')),
  prompt       text,
  file_url     text,                       -- Storage 中的文件地址
  user_id      uuid references auth.users(id),
  created_at   timestamptz default now()
);

-- 开启行级安全（RLS）
alter table public.workflows enable row level security;
alter table public.generations enable row level security;

-- 策略：登录用户只能读写自己的数据
create policy "own workflows" on public.workflows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own generations" on public.generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3. 创建图片存储桶（Storage）
1. 左侧 **Storage** → **New bucket**
2. 名称：`outputs`，勾选 **Public bucket**（生成的图片可直链访问）
3. 在 SQL Editor 加访问策略：

```sql
create policy "authenticated upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'outputs');

create policy "public read" on storage.objects
  for select using (bucket_id = 'outputs');
```

### 4. 获取密钥
- **Settings → API** 页面，记下两个值：
  - `Project URL`（形如 `https://xxxx.supabase.co`）
  - `anon public` key（前端可安全使用，配合 RLS 保护数据）
- ⚠️ `service_role` key 绝不要放进前端代码！

---

## 第三部分：把两者接起来

### 1. 在 Cloudflare 配置环境变量
Pages 项目 → **Settings → Environment variables**，添加：

| 变量名 | 值 |
|---|---|
| `VITE_SUPABASE_URL` | 你的 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 你的 anon key |

> Vite 项目中以 `VITE_` 开头的变量才会注入前端。改完后需 **Retry deployment** 重新构建生效。

### 2. 前端接入代码
项目需要安装 Supabase 客户端并添加保存/加载逻辑：

```bash
npm install @supabase/supabase-js
```

核心功能：
- ☁️ **云端保存工作流**：把画布的节点+连线 JSON 存进 `workflows` 表
- 📂 **加载工作流**：打开网站时列出已保存的工作流，一键恢复画布
- 🖼️ **图片入库**：保存节点除了下载到本地，同时上传到 Storage 的 `outputs` 桶并写入 `generations` 历史
- 🔐 **（可选）登录**：Supabase Auth 支持邮箱魔法链接 / GitHub / Google 登录

### 3. 本地开发
项目根目录建 `.env.local`（已被 .gitignore 忽略，不会泄露）：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG......
```

然后 `npm run dev` 即可本地联调。

---

## 常见问题

**Q: AI API 跨域（CORS）被拦怎么办？**
部署到 Cloudflare 后如果你的 AI 接口不允许浏览器直接调用，可以加一个 Cloudflare **Pages Function** 做转发代理（在仓库加 `functions/api/[[path]].js` 即可，无需额外服务器）。需要的话我可以直接写好。

**Q: 免费额度够吗？**
- Cloudflare Pages 免费版：每月 500 次构建、无限流量 ✅
- Supabase 免费版：500MB 数据库 + 1GB Storage ✅
个人项目完全够用。

**Q: 部署后页面空白？**
检查构建输出目录是否填了 `dist`，以及浏览器控制台是否有环境变量缺失报错。

---

## 检查清单

- [ ] Cloudflare Pages 已连接 GitHub 仓库并成功部署
- [ ] Supabase 项目已创建，SQL 表 + Storage 桶已建好
- [ ] 环境变量已在 Cloudflare 配置并重新部署
- [ ] 前端已接入 `@supabase/supabase-js`（可让 Tasklet 代写并推送）
- [ ] 打开 `*.pages.dev` 地址验证功能
