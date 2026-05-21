import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "DAM | Defence Against Misinformation",
  description:
    "DAM is an evidence-first intelligence layer for reviewing claims before distribution.",
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
