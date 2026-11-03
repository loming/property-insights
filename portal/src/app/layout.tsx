import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ViewTransition } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { SkipLink } from "@/components/layout/skip-link";
import { Providers } from "@/components/providers";
import { PAGE_NAVIGATION } from "@/lib/transitions";

import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { template: "%s · Property Insights", default: "Property Insights" },
  description: "Estimate property prices and analyse the housing market with a regression model.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        <Providers>
          <AppHeader />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6">
            {/* Navigating from the nav bars crossfades the page (globals.css); nothing else animates (see
                lib/transitions.ts). The one wrapping element takes the transition's name: children swapped
                directly under the ViewTransition could take it twice, and the browser aborts on that. */}
            <ViewTransition default={{ [PAGE_NAVIGATION]: "page", default: "none" }}>
              <div>{children}</div>
            </ViewTransition>
          </main>
          <footer className="border-t text-sm text-muted-foreground">
            <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
              <span>Property Insights: a full-stack take-home on a 50-home dataset.</span>
              <a className="underline underline-offset-4 hover:text-foreground" href="/ml-api/docs">
                Model API (Swagger)
              </a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
