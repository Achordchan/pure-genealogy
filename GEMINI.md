# pure-genealogy 族谱项目 - AI 编码指南

## 项目概述

这是一个全中文族谱管理应用。前端使用 Next.js App Router 和 React，后端使用 Go API，数据库使用 PostgreSQL；业务代码不要再新增 Supabase 直连逻辑。

## 技术栈

- **前端**：Next.js、React、TypeScript、Tailwind CSS、shadcn/ui。
- **后端**：Go、PostgreSQL、SSE、本地文件存储。
- **可视化**：`@xyflow/react` 用于 2D 族谱图，`react-force-graph-3d` 用于 3D 族谱图，`recharts` 用于统计仪表盘。
- **富文本**：`slate`、`slate-react`、`slate-history` 用于生平事迹编辑。

## 架构规则

- 前端访问后端统一走 `lib/api/`，服务端组件和 Server Action 使用 `apiFetch<T>()`。
- 路由保护在 `proxy.ts` 中调用 `lib/api/proxy.ts`，通过 `/api/auth/me` 判断当前账号。
- 后台红点和审核通知使用 SSE：前端 `components/backoffice-realtime-provider.tsx`，后端 `/api/events`。
- 禁止用轮询实现通信功能。
- 新增页面文案必须为中文，保留现有 shadcn/ui 和 Tailwind 体系，不新增手写大段 CSS。

## 数据刷新规则

族谱成员、附件、祭祀资料、资料草稿发生变更后，需要按影响范围调用 `revalidatePath()`，保持列表、图谱、统计、生平册、时间轴的数据一致。

## 核心模块

- `app/family-tree/`：成员列表、详情、导入、附件、祭祀编辑入口。
- `app/family-tree/graph/`：2D 族谱图。
- `app/family-tree/graph-3d/`：3D 关系网和自动巡游。
- `app/family-tree/rituals/`：祭祀检索、详情抽屉、地图预览。
- `app/me/`：我的资料和资料草稿。
- `app/review/`：草稿审核。
- `app/admin/`：账号审核。
- `server/internal/handlers/`：Go API 入口。
- `server/internal/repo/`：PostgreSQL 读写。

## 开发命令

```bash
npm run dev
npm run build
npx tsc --noEmit
cd server && go test ./...
```

`npm run build` 使用 Webpack，当前 macOS 环境下 Turbopack 会受 Next SWC 原生包签名问题影响。

## 环境变量

前端 `.env.local`：

```env
API_BASE_URL=http://127.0.0.1:8080
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
NEXT_PUBLIC_FAMILY_SURNAME=陈
NEXT_PUBLIC_AMAP_KEY=你的_高德地图_Web_Key
```

后端 `server/.env`：

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/zupu?sslmode=disable
ACCOUNT_ID_HASH_SALT=请替换为高强度随机字符串
INITIAL_ADMIN_ID_HASHES=管理员身份证哈希1,管理员身份证哈希2
APP_ORIGIN=http://localhost:3000
DATA_DIR=./data
```
