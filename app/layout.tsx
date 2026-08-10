import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import ContentStudioPreviewBridge from "../components/ContentStudioPreviewBridge";
import GoogleAnalyticsConsent from "../components/GoogleAnalyticsConsent";
import ProductAnalytics from "../components/ProductAnalytics";
import { GOOGLE_ANALYTICS_ID } from "../lib/googleAnalytics";
import { siteUrl } from "../lib/siteMetadata";
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
  metadataBase: new URL(siteUrl),
  title: "VRena_Booking_App",
  description: "Book and play VR games at VRena",
  alternates: {
    canonical: "/",
  },
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
      <Script id="vrena-booking-google-analytics-init" strategy="beforeInteractive">
        {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};if(!window.__vrenaGoogleAnalyticsConfigured){window.__vrenaGoogleAnalyticsConfigured=true;window.gtag("consent","default",{ad_personalization:"denied",ad_storage:"denied",ad_user_data:"denied",analytics_storage:"denied",wait_for_update:500});window.gtag("js",new Date());window.gtag("config","${GOOGLE_ANALYTICS_ID}",{anonymize_ip:true,send_page_view:false})}`}
      </Script>
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="booking-privacy-footer">
          <span id="vrena-booking-mobile-privacy-choices-slot" />
        </footer>
        <ContentStudioPreviewBridge />
        <Suspense fallback={null}>
          <ProductAnalytics />
          <GoogleAnalyticsConsent />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
