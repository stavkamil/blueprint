import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Title and description for browser tabs and search results. */
export const metadata: Metadata = {
  title: "{{projectName}}",
  description: {{descriptionLiteral}},
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

/** The root layout every page renders inside. */
const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body className="antialiased">{children}</body>
  </html>
);

export default RootLayout;
