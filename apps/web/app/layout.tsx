import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "KusaPics 多语言本地化工作台",
  description: "用于从 KusaPics 前端代码抽取静态文案候选、翻译、校对并回写结果的内部工具。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
