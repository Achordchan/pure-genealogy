# 族谱 Go 后端

这是族谱系统的本地 Go API，负责登录、账号审核、族谱成员、资料草稿、附件、祭祀资料与后台待办 SSE。

## 本机启动

```bash
cd server
cp .env.example .env
# 修改 DATABASE_URL、ACCOUNT_ID_HASH_SALT
go run ./cmd/api
```

健康检查：

```bash
curl http://127.0.0.1:8080/healthz
```

## 数据库迁移

当前迁移文件在 `migrations/001_init_schema.sql`，保留族谱主表并新增 `app_users`、`sessions`、`audit_logs`。本阶段没有引入 Redis。

```bash
psql "$DATABASE_URL" -f migrations/001_init_schema.sql
```

## 前端接入

前端通过下面两个变量访问 Go API：

```bash
API_BASE_URL=http://127.0.0.1:8080
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
```

主要接口：

- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/members`
- `GET /api/members/:id`
- `POST /api/members`
- `PUT /api/members/:id`
- `DELETE /api/members`
- `GET /api/rituals`
- `GET /api/rituals/members/:memberId`
- `PUT /api/rituals/members/:memberId`
- `DELETE /api/rituals/members/:memberId`
- `GET /api/assets/:id/download`
- `GET /api/events`

## 迁移边界

- 禁止轮询，后台通知用 SSE。
- 附件使用本地磁盘目录，由 Go API 统一鉴权上传和下载。
- 写操作权限在 Go middleware 和 service 层校验。
