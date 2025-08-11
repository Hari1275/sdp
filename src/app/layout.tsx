import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextAuthSessionProvider from "@/providers/session-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SDP Ayurveda Dashboard",
  description: "Field management solution for SDP Ayurveda with GPS tracking and performance analytics",
  keywords: ["ayurveda", "field management", "GPS tracking", "dashboard", "MR management"],
  authors: [{ name: "SDP Ayurveda" }],
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: [
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [
      { url: "/favicon.png", type: "image/png" },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NextAuthSessionProvider>
          {children}
          <Toaster />
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
