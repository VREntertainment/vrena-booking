import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  title: "VRena_Booking_App",
  description: "Book and play VR games at VRena",
  icons: {
    icon: [
      { url: "/vrena-icon-20260616.png", sizes: "512x512", type: "image/png" },
      { url: "/vrena-favicon-20260616.ico", sizes: "any", type: "image/x-icon" },
    ],
    shortcut: ["/vrena-favicon-20260616.ico"],
    apple: [{ url: "/vrena-apple-icon-20260616.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
