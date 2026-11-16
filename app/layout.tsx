import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "考前冲刺复习站 · Exam Sprint Hub",
  description: "上传课件和大纲，自动生成带每日计划、概念卡、自测题和案例教练的双语复习网站。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
