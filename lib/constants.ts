import type { CustomerGrade, CustomerSource, CustomerStatus, TaskCategory } from "@/types/database";

export const CUSTOMER_SOURCES: CustomerSource[] = [
  "阿里国际站",
  "RFQ",
  "展会",
  "独立站",
  "社媒",
  "老客户介绍",
  "其他",
];

export const CUSTOMER_GRADES: CustomerGrade[] = ["A", "B", "C"];

export const CUSTOMER_STATUSES: Array<{ value: CustomerStatus; label: string }> = [
  { value: "no_reply_inquiry", label: "询盘未回复" },
  { value: "no_reply_quote", label: "报价未回复" },
  { value: "no_reply_followup", label: "多次跟进未回复" },
  { value: "pending_quote", label: "待报价" },
  { value: "catalog_sent", label: "已发产品目录" },
  { value: "price_negotiation", label: "价格谈判中" },
  { value: "pending_recommend", label: "待推荐产品" },
  { value: "pending_drawing", label: "待确认图纸" },
  { value: "pending_sample", label: "待寄样" },
  { value: "sample_sent", label: "已寄样" },
  { value: "no_order", label: "未下单" },
  { value: "pending_factory", label: "待验厂" },
  { value: "factory_done", label: "已验厂" },
  { value: "pending_order", label: "待下单" },
  { value: "closed", label: "已成交" },
  { value: "lost", label: "已流失" },
];

export const TASK_CATEGORIES: Array<{ value: TaskCategory; label: string }> = [
  { value: "inquiry", label: "询盘" },
  { value: "rfq", label: "RFQ" },
  { value: "product", label: "产品" },
  { value: "relationship", label: "客情" },
  { value: "data", label: "数据" },
  { value: "development", label: "开发" },
  { value: "other", label: "其他" },
];

export const FIXED_TASK_TEMPLATES = [
  {
    category: "daily",
    title: "回复所有询盘和消息",
    taskCategory: "inquiry",
    sortOrder: 1,
  },
  {
    category: "daily",
    title: "刷RFQ，发有效报价（目标10条）",
    taskCategory: "rfq",
    sortOrder: 2,
  },
  {
    category: "daily",
    title: "优化1个低流量产品（标题/主图/详情）",
    taskCategory: "product",
    sortOrder: 3,
  },
  {
    category: "daily",
    title: "记录客户、更新跟进状态",
    taskCategory: "relationship",
    sortOrder: 4,
  },
  {
    category: "weekly",
    weekday: 1,
    title: "看上周数据（曝光、点击、询盘），逛同行店铺",
    taskCategory: "data",
    sortOrder: 10,
  },
  {
    category: "weekly",
    weekday: 3,
    title: "集中拍摄新品、完成上架，补充产品资料",
    taskCategory: "product",
    sortOrder: 11,
  },
  {
    category: "weekly",
    weekday: 5,
    title: "整理未回复客户，发邮件开发新客户",
    taskCategory: "development",
    sortOrder: 12,
  },
] as const;

export const GRADE_STYLES: Record<CustomerGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-amber-100 text-amber-700 border-amber-200",
  C: "bg-slate-100 text-slate-600 border-slate-200",
};

export const STATUS_STYLES: Record<CustomerStatus, string> = {
  no_reply_inquiry: "bg-rose-100 text-rose-700 border-rose-200",
  no_reply_quote: "bg-orange-100 text-orange-700 border-orange-200",
  no_reply_followup: "bg-slate-100 text-slate-600 border-slate-200",
  pending_quote: "bg-sky-100 text-sky-700 border-sky-200",
  catalog_sent: "bg-sky-100 text-sky-700 border-sky-200",
  price_negotiation: "bg-violet-100 text-violet-700 border-violet-200",
  pending_recommend: "bg-sky-100 text-sky-700 border-sky-200",
  pending_drawing: "bg-amber-100 text-amber-700 border-amber-200",
  pending_sample: "bg-amber-100 text-amber-700 border-amber-200",
  sample_sent: "bg-orange-100 text-orange-700 border-orange-200",
  no_order: "bg-slate-100 text-slate-600 border-slate-200",
  pending_factory: "bg-amber-100 text-amber-700 border-amber-200",
  factory_done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending_order: "bg-sky-100 text-sky-700 border-sky-200",
  closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-slate-100 text-slate-600 border-slate-200",
};
