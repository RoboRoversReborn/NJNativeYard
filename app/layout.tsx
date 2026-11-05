import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NativeYard NJ — See your New Jersey yard through nature's eyes",
  description:
    "Upload a yard photo to identify New Jersey native, non-native, and invasive plants, get a biodiversity score, and receive a keystone-native replacement plan calibrated to your NJ county and physiographic province.",
  applicationName: "NativeYard NJ",
  keywords: [
    "New Jersey native plants",
    "NJ invasive species",
    "pollinator garden",
    "keystone plants",
    "yard audit",
    "biodiversity",
    "NPSNJ",
    "Jersey-Friendly Yards",
  ],
  openGraph: {
    title: "NativeYard NJ — See your New Jersey yard through nature's eyes",
    description:
      "A photo-based New Jersey yard audit that turns invasive plants into a native habitat plan.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NativeYard NJ",
    description:
      "See what your New Jersey yard is feeding—and what it could feed instead.",
  },
};

export const viewport: Viewport = {
  themeColor: "#163f2c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-[#f7f4e9] font-sans text-[#1d2a21]">
        {children}
      </body>
    </html>
  );
}
