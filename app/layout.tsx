import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABCF Production Team",
  description: "Unified church production platform for livestream, lyrics, and teleprompter coordination.",
  applicationName: "ABCF Production Team",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
