import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Pantry — Ingredients & meal planner",
    template: "%s · Pantry",
  },
  description:
    "Track ingredients and supplements, discover recipes, and plan your week with embedded cooking videos.",
  openGraph: {
    title: "Pantry — Ingredients & meal planner",
    description:
      "Track ingredients and supplements, discover recipes, and plan your week.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-svh flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
