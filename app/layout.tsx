import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Premium Website — Cinematic Core",
  description: "Scroll-controlled real-time 3D cinematic experience built with Next.js, React Three Fiber and GSAP."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#02050a"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
