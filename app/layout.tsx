import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Don't share this yet",
  description: "A lightweight claim checker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
  {children}
  <Analytics />
</body>
    </html>
  );
}
