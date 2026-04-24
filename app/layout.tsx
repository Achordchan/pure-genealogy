import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { FAMILY_SURNAME } from "@/lib/utils";
import { AppToaster } from "@/components/app-toaster";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: `${FAMILY_SURNAME}氏族谱管理系统`,
  description: "基于 Next.js 和 Go API 构建的家族族谱管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-serif antialiased">
        <NextTopLoader color="#2A6E4D" showSpinner={false} shadow="0 0 10px #2A6E4D,0 0 5px #2A6E4D" />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <AppToaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
