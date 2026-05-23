import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoboTutor 6DOF",
  description: "Interactive 6DOF robotic arm FK/IK teaching workbench"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
