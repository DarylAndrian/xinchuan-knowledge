import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import TopBar from "@/components/TopBar";
import WebMCPTools from "@/components/WebMCPTools";
import pkg from "@/package.json";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const themeScript = `
  (function () {
    try {
      var saved = localStorage.getItem("theme");
      var theme = saved === "light" || saved === "dark"
        ? saved
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`;

export const metadata: Metadata = {
  title: "Xinchuan Knowledge Center",
  description: "One place for everything we know.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  const siteName = getSetting("site_name", "Xinchuan Knowledge Center");

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <TopBar user={user} siteName={siteName} version={pkg.version} />
        <WebMCPTools />
        {children}
      </body>
    </html>
  );
}
