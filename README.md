# 外贸工作台

基于 `Next.js 14 + TypeScript + Tailwind CSS + Supabase` 的中文外贸协作工作台，面向两人小团队，包含客户 CRM、每日任务和数据看板三个核心模块。

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 配置环境变量：

```bash
cp .env.example .env.local
```

填写：

```env
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase Anon Key
```

3. 在 Supabase SQL 编辑器执行 [supabase/schema.sql](/Users/chenmanli/Documents/New%20project/supabase/schema.sql)。

4. 启动开发环境：

```bash
npm run dev
```

## 每个模块怎么测试

### 1. 登录

- 打开 `/login`
- 用 Supabase Auth 已存在账号登录
- 未登录访问 `/dashboard`、`/customers`、`/tasks` 时应跳回登录页

### 2. 客户 CRM

- 在 `/customers` 新增客户，确认统计卡片和列表即时更新
- 编辑客户，确认详情弹窗和卡片信息同步变化
- 新增沟通记录，确认详情中按时间倒序显示
- 将 `next_follow_date` 设为今天或过去，确认横幅和排序优先级生效

### 3. 每日清单

- 打开 `/tasks`，确认当天自动生成 4 条固定任务且不会重复
- 新增自定义任务、勾选完成、删除任务
- 保存当日数据后刷新页面，确认内容回填

### 4. 数据看板

- 在 `/dashboard` 检查本月汇总卡、30 天折线图、漏斗和来源分布
- 修改客户、任务或日报后，确认页面会自动同步刷新

## 部署

- 推送到 GitHub 后，在 Vercel 导入仓库
- 将 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 配置到 Vercel 环境变量
- 重新部署即可
