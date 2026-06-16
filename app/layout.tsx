import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      { url: "/vrena-icon.png?v=vrena-mark-20260616", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=vrena-mark-20260616", sizes: "any", type: "image/x-icon" },
    ],
    shortcut: ["/vrena-icon.png?v=vrena-mark-20260616"],
    apple: [{ url: "/apple-icon.png?v=vrena-mark-20260616", sizes: "180x180", type: "image/png" }],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
