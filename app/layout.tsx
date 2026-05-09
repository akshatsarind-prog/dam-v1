import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
