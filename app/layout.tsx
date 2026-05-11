import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "外贸工作台",
  description: "面向两人外贸团队的客户、任务与数据协作工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
