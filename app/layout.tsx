import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atlas Interior Browser",
  description: "DSL to photorealistic wall section renderer"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
