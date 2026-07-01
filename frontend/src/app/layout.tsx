import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { KeycloakProvider } from "@/components/KeycloakProvider";
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
  title: "Multi-Agent Architect",
  description: "AI-powered software architect — solution design and ticket planning",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-full" suppressHydrationWarning>
        <KeycloakProvider>
          <Sidebar />
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </KeycloakProvider>
      </body>
    </html>
  );
}
