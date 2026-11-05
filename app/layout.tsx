import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NativeYard NJ: See what your New Jersey yard is really growing",
  description:
    "Take a photo of your yard. We identify native and invasive plants, score your habitat, and suggest practical native swaps suited to your county and soil.",
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
    title: "NativeYard NJ: Turn your yard into a living habitat",
    description:
      "A quick photo audit for New Jersey homeowners. Identify invasive weeds, spot keystone trees, and get a practical planting roadmap.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NativeYard NJ",
    description:
      "Take a photo of your yard to see what it feeds today, and what it could support tomorrow.",
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
