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
  { value: "new", label: "新询盘" },
  { value: "follow", label: "跟进中" },
  { value: "sample", label: "寄样中" },
  { value: "closed", label: "已成交" },
  { value: "lost", label: "已流失" },
];

export const TASK_CATEGORIES: Array<{ value: TaskCategory; label: string }> = [
  { value: "inquiry", label: "询盘" },
  { value: "rfq", label: "RFQ" },
  { value: "product", label: "产品" },
  { value: "relationship", label: "客情" },
  { value: "other", label: "其他" },
];

export const FIXED_TASK_TEMPLATES = [
  {
    templateKey: "reply_inquiries",
    title: "回复所有询盘和消息",
    category: "inquiry",
  },
  {
    templateKey: "send_rfq_quotes",
    title: "刷RFQ，发有效报价（目标10条）",
    category: "rfq",
  },
  {
    templateKey: "optimize_product",
    title: "优化1个低流量产品（标题/主图/详情）",
    category: "product",
  },
  {
    templateKey: "update_customer_followups",
    title: "更新客户跟进记录",
    category: "relationship",
  },
] as const;

export const GRADE_STYLES: Record<CustomerGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-amber-100 text-amber-700 border-amber-200",
  C: "bg-slate-100 text-slate-600 border-slate-200",
};

export const STATUS_STYLES: Record<CustomerStatus, string> = {
  new: "bg-sky-100 text-sky-700 border-sky-200",
  follow: "bg-indigo-100 text-indigo-700 border-indigo-200",
  sample: "bg-orange-100 text-orange-700 border-orange-200",
  closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-rose-100 text-rose-700 border-rose-200",
};
