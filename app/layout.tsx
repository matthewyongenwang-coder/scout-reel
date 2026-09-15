import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { accountsEnabled } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Scout Reel", template: "%s | Scout Reel" },
  description: "Scout VEX V5 teams with every match from their season in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Scout Reel
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {/* A static check, so the layout never reads cookies and pages stay fast for visitors. */}
              {accountsEnabled() ? (
                <>
                  <Link href="/scouting" className="text-muted hover:text-foreground">
                    Scouting
                  </Link>
                  <Link href="/account" className="text-muted hover:text-foreground">
                    Account
                  </Link>
                </>
              ) : null}
              <Link href="/about" className="text-muted hover:text-foreground">
                About
              </Link>
              <a
                href="https://github.com/matthewyongenwang-coder/scout-reel"
                className="text-muted hover:text-foreground"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
            Community project. Not affiliated with VEX Robotics, the REC Foundation, or YouTube.
          </div>
        </footer>
      </body>
    </html>
  );
}
