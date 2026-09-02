import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import TopBar from "@/components/TopBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <TopBar user={user} siteName={siteName} />
        {children}
      </body>
    </html>
  );
}
