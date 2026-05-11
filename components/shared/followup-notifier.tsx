"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export function FollowupNotifier({
  dueCount,
  className,
}: {
  dueCount: number;
  className?: string;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || permission !== "granted" || dueCount <= 0) {
      return;
    }

    const hour = new Date().getHours();
    if (hour < 9) {
      return;
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const notifyKey = `waimao-workbench:notified:${dateKey}`;
    if (window.localStorage.getItem(notifyKey) === "true") {
      return;
    }

    const notification = new Notification(`今日有 ${dueCount} 位客户需要跟进，请及时处理`, {
      body: "点击通知可直接打开客户管理并筛选今日需跟进客户。",
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = "/customers?filter=due-today";
    };
    window.localStorage.setItem(notifyKey, "true");
  }, [dueCount, permission]);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (dueCount <= 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-2 text-amber-600">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-900">浏览器提醒</p>
            <p className="text-sm text-amber-800">
              今天有 {dueCount} 位客户需要跟进。开启提醒后，上午 9 点后打开网页时会自动弹出浏览器通知。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link className={cn(buttonVariants({ variant: "outline" }))} href="/customers?filter=due-today">
            查看待跟进客户
          </Link>
          {permission === "default" ? <Button onClick={requestPermission}>开启提醒</Button> : null}
          {permission === "granted" ? <span className="text-xs text-emerald-700">已开启提醒</span> : null}
          {permission === "denied" ? <span className="text-xs text-rose-700">浏览器已拒绝提醒权限</span> : null}
        </div>
      </div>
    </div>
  );
}
