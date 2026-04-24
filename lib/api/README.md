# Go API 接入说明

`lib/api/` 是前端访问 Go 后端的统一入口，当前业务主链路已经通过这里转到 Go API，不再在页面和 Server Action 中直接查询 Supabase 表。

## 环境变量

- `API_BASE_URL`：服务端请求 Go API 的地址，例如 `http://127.0.0.1:8080`。
- `NEXT_PUBLIC_API_BASE_URL`：浏览器端请求 Go API 的地址，用于 SSE 等客户端能力。

## 请求规则

- 服务端组件或 Server Action 使用 `apiFetch<T>()`。
- `apiFetch<T>()` 自动把 Next.js 请求 Cookie 转发给 Go API，并把后端 `set-cookie` 写回浏览器。
- Go API 返回非 2xx 时，优先读取 JSON 的 `message` 或 `error` 字段；没有可读文案时按 HTTP 状态码返回中文错误。

## 已接入链路

| 前端入口 | Go API |
| --- | --- |
| 登录、注册、退出、当前账号 | `/api/auth/*`、`/api/account/me` |
| 账号审核与后台待办 | `/api/accounts/*`、`/api/notices/backoffice-counts`、`/api/events` |
| 族谱成员列表、详情、保存、删除、导入 | `/api/members/*` |
| 2D 图谱、统计、生平册、时间轴 | `/api/members/graph` |
| 祭祀检索、详情、保存、删除 | `/api/rituals/*` |
| 成员附件上传、列表、下载、删除 | `/api/assets/*` |
| 我的资料与资料草稿审核 | `/api/account/me`、`/api/drafts/*` |

## 维护原则

迁移或新增功能时保留现有 Server Action 函数名，让页面继续调用原函数；函数内部统一调用 `apiFetch<T>()`，避免页面层并行出现 Go API 与旧数据库直连两套逻辑。
