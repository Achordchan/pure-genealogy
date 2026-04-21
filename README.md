# pure-genealogy 族谱管理系统

<p align="center">
  <img alt="pure-genealogy Tree" src="app/demo.gif" width="800">
</p>

<p align="center">
  一个基于 Next.js 15 和 Supabase 构建的现代化、全中文家族族谱管理系统。
</p>

## ✨ 项目亮点

- **前沿技术栈**: 采用最新的 **Next.js 15** (App Router) 和 **React 19**。
- **全栈无服务**: 后端使用 **Supabase**，提供高性能数据库、身份认证及实时订阅功能。
- **深度中文化**: 针对中文语境深度定制，包括 UI 文案、日期格式、元数据及字辈统计。
- **多维可视化 (v2.0升级)**:
  - **2D 族谱图**: 全新升级的渲染引擎。支持**世代标尺**指引、**松柏绿瀑布式**代际渐变色、**配偶直显**。提供“金线溯源”与“金扇繁衍”的双向高亮交互，支持高清大图导出。
  - **3D 关系网**: 沉浸式三维力导向图，新增**自动巡游 (Auto Tour)** 功能，可自动规划路径并在家族成员间漫游。
  - **家族统计**: 多维度数据仪表盘，包含世代增长趋势、字辈统计等。
  - **历史时间轴**: 直观展示家族成员的生卒年时间分布。
- **沉浸式体验**:
  - **"Living Book" 详情页**: 独创的 3D 翻书/画卷交互，正面展示档案，背面展示生平。
  - **富文本生平**: 集成 Slate.js 编辑器，支持排版精美的生平传记，阅读模式支持**逐字书写/毛笔扫过**的艺术动效。

## 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **数据库 & 认证**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Realtime)
- **UI 组件库**: [shadcn/ui](https://ui.shadcn.com/) (基于 Radix UI)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **可视化**: 
  - [@xyflow/react](https://reactflow.dev/) (2D Graph)
  - [react-force-graph-3d](https://github.com/vasturiano/react-force-graph-3d) (3D Graph)
  - [recharts](https://recharts.org/) (Charts)
- **富文本**: [Slate.js](https://docs.slatejs.org/) (生平事迹编辑)
- **工具**: TypeScript, ESLint, Lucide React (图标), html-to-image (图片导出)

## 🚀 主要功能

### 1. 核心管理 (`/family-tree`)
- **成员档案**: 记录姓名、字辈、父母、配偶、生卒年、居住地、官职等详细信息。
- **富文本生平**: 支持加粗、斜体等格式的生平事迹记录。
- **Living Book 交互**: 详情页采用拟物化设计，PC 端呈现书卷质感，移动端为全屏卡片。
- **便捷操作**: 支持成员搜索、增删改查、以及 Excel/CSV 数据的批量导入导出。

### 2. 可视化视图
- **2D 族谱图 (`/family-tree/graph`)**: 
  - **自动布局**: 基于 Dagre 算法的层级树状图。
  - **视觉增强**: 左侧自动生成水墨风“世代标尺”，节点根据代数深浅渐变。
  - **交互体验**: 点击节点触发“金线溯源”（高亮祖先路径）和“金扇繁衍”（高亮子孙路径）。
  - **图片导出**: 支持一键导出带背景和水印的高清家族树图片。
- **3D 力导向图 (`/family-tree/graph-3d`)**: 
  - **星空漫游**: 炫酷的 3D 节点展示。
  - **自动巡游**: 自动计算任意两名成员间的最短关系路径，并控制相机自动飞行浏览。
- **统计仪表盘 (`/family-tree/statistics`)**: 家族人口概览、性别/在世比例、世代增长趋势、年龄分布、字辈频率统计。
- **时间轴 (`/family-tree/timeline`)**: 横向时间轴展示家族历史跨度。

### 3. 系统功能
- **身份认证**: 使用“姓名 + 身份证号”注册登录。系统仍通过 Supabase Auth 维护会话，但前台不再使用邮箱登录；新账号默认进入待审核状态。
- **实时同步**: 多端数据实时更新。
- **响应式设计**: 完美适配桌面端与移动端，针对移动端优化了导航和工具栏布局，支持明暗主题切换。

## 📦 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yunfengsa/pure-genealogy.git
cd pure-genealogy
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` (或新建) 为 `.env.local` 并填入 Supabase 项目配置：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_Supabase_项目_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的_Supabase_Anon_Key
ACCOUNT_ID_HASH_SALT=你自定义的一串高强度随机字符
INITIAL_ADMIN_ID_HASHES=管理员身份证哈希1,管理员身份证哈希2
NEXT_PUBLIC_FAMILY_SURNAME=陈
```

`INITIAL_ADMIN_ID_HASHES` 的值需要按“规范化身份证号 -> SHA-256”得到哈希后填写，规范化规则为：去掉空格、末尾 `x` 转成大写 `X`。项目运行时会再叠加 `ACCOUNT_ID_HASH_SALT` 做正式哈希。

### 4. 初始化数据库

在 Supabase 项目的 SQL Editor 中执行 [supabase/init.sql](./supabase/init.sql) 中的完整脚本。这个脚本会一次性完成下面这些内容：

- `family_members` 主表
- `account_profiles` 账号资料表
  - `role = admin | editor | member`
  - `status = pending | approved | rejected`
  - `member_id` 用来绑定唯一的族谱成员
- `member_change_requests` 普通用户资料草稿表
- `RLS = 行级权限控制`
  - 普通用户只能读自己的账号资料、提交自己的资料草稿
  - 编辑员可以新增和修改族谱成员，但不能删除
  - 管理员可以审核账号、分配角色、绑定成员、删除成员
- `app_current_role()` / `app_is_admin()` / `app_is_editor()` / `app_bound_member_id()` 等数据库辅助函数

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 开始使用。首批管理员需要先在环境变量中配置身份证哈希白名单；普通用户注册后会停留在“信息正在审核中”页面，等待管理员在 `/admin/accounts` 审核，并在审核时绑定对应的族谱成员。

## 🔐 权限模型

- `admin`
  - 账号审核、账号管理、角色分配、成员绑定
  - 族谱成员增删改查、批量导入
  - 草稿审核
- `editor`
  - 族谱成员新增和修改
  - 草稿审核
- `member`
  - 查看 2D/3D 族谱、时间轴、统计分析、生平册
  - 查看自己的资料
  - 提交自己的资料草稿，等待审核

账号批准规则：

- 白名单管理员注册后直接成为 `approved + admin`
- 普通账号注册后默认为 `pending + member`
- 管理员批准普通账号时，必须同时选择 `role` 和 `member_id`

## 📂 项目结构

```
/
├── app/                  # Next.js App Router 核心目录
│   ├── auth/             # 认证流程页面
│   ├── admin/            # 管理员账号审核与账号管理
│   ├── family-tree/      # 族谱主要功能区
│   │   ├── graph/        # 2D 视图 (React Flow)
│   │   ├── graph-3d/     # 3D 视图 (Force Graph)
│   │   ├── statistics/   # 统计仪表盘
│   │   ├── timeline/     # 时间轴
│   │   ├── biography-book/ # 传记书模式
│   │   └── page.tsx      # 成员列表
│   ├── me/               # 我的资料与我的草稿
│   ├── review/           # 草稿审核
│   └── ...
├── components/           # React 组件
│   ├── ui/               # shadcn/ui 基础组件
│   ├── rich-text/        # Slate 富文本编辑器组件
│   └── ...
├── lib/                  # 工具函数与 Supabase 客户端配置
└── hooks/                # 自定义 Hooks
```

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。
