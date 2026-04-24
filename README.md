# pure-genealogy 族谱管理系统

一个全中文家族族谱管理系统。前端使用 Next.js App Router，后端使用 Go API，数据库使用 PostgreSQL；业务主链路已经从 Supabase 直连收口到 Go 后端。

## 功能范围

- **身份认证**：使用“姓名 + 身份证号”注册登录；普通成员注册后进入待审核状态，管理员审核后分配角色并绑定族谱成员。
- **族谱管理**：支持成员增删改查、批量导入、成员详情、资料附件上传与下载。
- **族谱展示**：支持 2D 族谱图、3D 关系网、统计仪表盘、时间轴、生平册。
- **祭祀管理**：支持按姓名、墓园、地址、墓位号检索已故成员，查看墓园位置、路线指引、祭扫说明和祭祀附件。
- **后台通知**：账号审核、草稿审核等后台红点通过 SSE 实时更新，不使用轮询。

## 技术栈

- **前端**：Next.js、React、Tailwind CSS、shadcn/ui、React Flow、Three.js、Slate。
- **后端**：Go、PostgreSQL、SSE、本地文件存储。
- **地图**：高德地图 JavaScript API，用于祭祀地点预览与导航。

## 本机启动

### 1. 安装前端依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
createdb zupu
psql "$DATABASE_URL" -f server/migrations/001_init_schema.sql
```

`DATABASE_URL` 示例：

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/zupu?sslmode=disable
```

### 3. 配置后端环境变量

在 `server/.env` 写入：

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/zupu?sslmode=disable
ACCOUNT_ID_HASH_SALT=请替换为高强度随机字符串
INITIAL_ADMIN_ID_HASHES=管理员身份证哈希1,管理员身份证哈希2
APP_ORIGIN=http://localhost:3000
DATA_DIR=./data
```

`INITIAL_ADMIN_ID_HASHES` 的值按“规范化身份证号 -> SHA-256”得到；规范化规则为去掉空格、末尾 `x` 转成大写 `X`。后端运行时会再叠加 `ACCOUNT_ID_HASH_SALT` 计算正式哈希。

### 4. 启动 Go 后端

```bash
cd server
go run ./cmd/api
```

健康检查：

```bash
curl http://127.0.0.1:8080/healthz
```

### 5. 配置前端环境变量

在 `.env.local` 写入：

```env
API_BASE_URL=http://127.0.0.1:8080
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
NEXT_PUBLIC_FAMILY_SURNAME=陈
NEXT_PUBLIC_AMAP_KEY=你的_高德地图_Web_Key
```

### 6. 启动前端

```bash
npm run dev
```

访问 `http://localhost:3000`。首页会进入 `/family-tree/graph`。

## 常用验证

```bash
npm run build
npx tsc --noEmit
cd server && go test ./...
```

`npm run build` 固定使用 Webpack，避免当前 macOS 环境里 Next SWC 原生包签名异常导致 Turbopack 构建失败。

## 权限模型

- `admin`：账号审核、角色分配、成员绑定、族谱成员增删改查、草稿审核、附件管理、祭祀资料维护。
- `editor`：族谱成员新增和修改、草稿审核、附件管理、祭祀资料维护。
- `member`：查看族谱、时间轴、统计、生平册、祭祀资料；维护自己的资料草稿。

账号批准规则：白名单管理员注册后直接成为 `approved + admin`；普通账号注册后默认为 `pending + member`；管理员批准普通账号时必须选择角色和绑定成员。

## 项目结构

```text
/
├── app/                  # Next.js App Router 页面与 Server Action
│   ├── auth/             # 注册、登录、待审核
│   ├── admin/            # 管理员账号审核
│   ├── family-tree/      # 族谱、图谱、统计、祭祀、生平册
│   ├── me/               # 我的资料与草稿
│   └── review/           # 草稿审核
├── components/           # 通用组件与 shadcn/ui
├── lib/api/              # Go API 请求工具与类型
├── lib/account/          # 账号权限与共享规则
├── server/               # Go 后端、迁移和接口处理
└── hooks/                # 前端 Hook
```

## 许可证

本项目采用 MIT 许可证。

## 致谢

本项目基于原作者的族谱项目分支继续二次开发，并在此基础上重构了前端体验、账号体系、Go 后端和本地 PostgreSQL 数据链路。感谢原作者提供最初的项目方向和基础实现。
