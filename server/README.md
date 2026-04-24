# 族谱系统 Go API

族谱系统后端服务，负责身份认证、账号审核、成员资料、资料草稿、附件、祭祀资料和后台实时通知。服务通过 HTTP API 对前端开放，数据库使用 PostgreSQL，附件使用本地磁盘存储。

## 环境变量

在 `server/.env` 写入：

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/zupu?sslmode=disable
ACCOUNT_ID_HASH_SALT=请替换为高强度随机字符串
INITIAL_ADMIN_ID_HASHES=管理员身份证哈希1,管理员身份证哈希2
APP_ORIGIN=http://localhost:3000
DATA_DIR=./data
PORT=8080
```

字段说明：

- `DATABASE_URL`：PostgreSQL 连接地址。
- `ACCOUNT_ID_HASH_SALT`：身份证哈希盐值，生产环境必须使用高强度随机字符串。
- `INITIAL_ADMIN_ID_HASHES`：初始管理员身份证哈希，多个值用英文逗号分隔。
- `APP_ORIGIN`：允许访问 API 的前端地址。
- `DATA_DIR`：附件和导入归档的本地存储目录。
- `PORT`：API 监听端口，默认 `8080`。

## 启动服务

```bash
cd server
cp .env.example .env
go run ./cmd/api
```

健康检查：

```bash
curl http://127.0.0.1:8080/healthz
```

## 初始化数据库

```bash
createdb zupu
psql "$DATABASE_URL" -f migrations/001_init_schema.sql
```

迁移脚本会创建成员、账号、会话、草稿、附件、祭祀资料和审计日志等业务表。

## 前端接入

前端 `.env.local` 需要配置：

```env
API_BASE_URL=http://127.0.0.1:8080
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
```

服务端渲染请求使用 `API_BASE_URL`，浏览器直连请求使用 `NEXT_PUBLIC_API_BASE_URL`。

## 主要接口

### 认证与账号

- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/admin/accounts`
- `PUT /api/admin/accounts/:id/status`

### 族谱成员

- `GET /api/members`
- `GET /api/members/:id`
- `POST /api/members`
- `PUT /api/members/:id`
- `DELETE /api/members`
- `GET /api/members/:id/account`
- `GET /api/family-members/options`

### 草稿审核

- `GET /api/drafts/pending`
- `POST /api/drafts/:id/approve`
- `POST /api/drafts/:id/reject`
- `GET /api/review/member-changes`

### 附件与导入

- `GET /api/members/:id/assets`
- `POST /api/members/:id/assets`
- `DELETE /api/assets/:assetId`
- `GET /api/assets/:assetId/download`
- `POST /api/imports/archive`

### 祭祀资料

- `GET /api/rituals`
- `GET /api/rituals/members/:memberId`
- `PUT /api/rituals/members/:memberId`
- `DELETE /api/rituals/members/:memberId`

### 实时通知

- `GET /api/events`
- `GET /api/admin/notices`

后台待办通知使用 SSE，禁止使用轮询。

## 存储说明

附件保存在 `DATA_DIR` 指向的本地目录中，数据库只保存附件元数据。生产环境部署时需要把该目录纳入备份策略，避免只备份数据库导致附件丢失。
