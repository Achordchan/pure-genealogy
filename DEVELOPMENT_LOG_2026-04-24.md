# 2026-04-24 开发记录

## 本日目标

继续完成族谱项目从 Supabase 直连架构迁移到本地 Go API + PostgreSQL 架构，并把祭祀、成员、账号、附件、审核等主链路跑通。

## 已完成内容

### 1. 后端与数据库

- 新增 Go API 后端，目录为 `server/`。
- 新增 PostgreSQL 初始化脚本：`server/migrations/001_init_schema.sql`。
- 本地 PostgreSQL 使用 Docker 容器 `zupu-postgres`，监听 `127.0.0.1:5433`。
- Go 后端默认监听 `http://localhost:8080`。
- 修复 Go 后端配置加载问题：后端现在会自动读取 `server/.env`，避免 `DATABASE_URL` 未加载导致连接池为空。
- 修复 Gin 路由冲突：`/api/members/:id` 与 `/api/members/:id/assets` 使用统一参数名。

### 2. Supabase 数据迁移

- 从旧 Supabase 控制台通过只读 SQL 导出业务数据。
- 导入到本地 PostgreSQL 的数据量：
  - `family_members`: 26
  - `account_profiles`: 3
  - `member_change_requests`: 1
  - `member_assets`: 1
  - `member_rituals`: 0
- 导入时重新创建本地 `app_users`，并使用当前 `ACCOUNT_ID_HASH_SALT` 重新生成身份证哈希。
- 迁移过程没有把旧 Supabase 密钥、数据库连接串、身份证明文写入 Git。

### 3. 前端迁移

- 前端业务主链路改为访问 Go API。
- 新增 `lib/api/` 作为前端请求 Go API 的统一入口。
- `proxy.ts` 改为通过 Go API 的 `/api/auth/me` 做路由保护。
- 登录、注册、账号审核、成员列表、成员详情、批量导入、统计、时间轴、生平册、祭祀、附件等链路已迁移。
- 删除旧 Supabase 客户端、模板教程、Realtime Chat 示例和未使用营销组件。

### 4. 祭祀功能

- 新增祭祀检索页：`app/family-tree/rituals/page.tsx`。
- 新增祭祀详情抽屉：`app/family-tree/rituals/ritual-detail-drawer.tsx`。
- 新增祭祀编辑弹窗：`app/family-tree/ritual-edit-dialog.tsx`。
- 支持祭祀资料保存、删除、检索、地图预览和导航。

### 5. 附件功能

- 附件列表、上传、下载改为 Go API 鉴权链路。
- 修复浏览器端附件请求报错：页面在 `localhost:3000`，客户端 API 必须使用 `http://localhost:8080`，避免 `localhost` 与 `127.0.0.1` Cookie 域名不一致。
- 当前旧附件元数据已迁入本地库；旧 Supabase Storage 文件本体仍需单独迁移到本地 `server` 存储目录。

### 6. 文档与启动方式

- 重写 `README.md`，说明当前 Go API 架构和本机启动方式。
- 重写 `GEMINI.md`，避免后续 AI 继续按旧 Supabase 架构开发。
- 新增 `server/README.md` 和 `server/.env.example`。
- 移除 `next/font/google` 运行时联网字体依赖，避免生产构建因字体下载失败卡住。

## 当前启动方式

### 数据库

```bash
docker start zupu-postgres
```

数据库地址：`127.0.0.1:5433`。

### 后端

```bash
cd /Users/achordchan/Downloads/不同步的桌面/项目/zupu/server
go run ./cmd/api
```

后端地址：`http://localhost:8080`。

### 前端

```bash
cd /Users/achordchan/Downloads/不同步的桌面/项目/zupu
npm run dev
```

前端地址：`http://localhost:3000`。

## 验证记录

已通过：

```bash
npm run build
npx tsc --noEmit
cd server && go test ./...
```

本地接口验证：

- 管理员账号可通过 Go API 登录。
- 成员图谱接口可读取 26 条成员数据。
- 成员附件列表接口返回 200。

## Git 记录

本批次已提交：

```bash
5ead88a Migrate zupu to Go API backend
```

当前分支：

```bash
achord-agent/supabase-v1
```

## 注意事项

- `.env.local` 和 `server/.env` 是本机配置文件，不进入 Git。
- `/tmp/zupu_supabase_export.json` 是迁移时生成的临时敏感数据文件，只应留在本机临时目录，不要提交。
- 旧 Supabase Storage 文件本体未完全落到本地存储目录，后续若要显示历史图片，需要继续迁移对象文件。
- Next SWC 在当前 macOS 上有签名警告，但 `npm run build` 已通过 Webpack 完成构建。
