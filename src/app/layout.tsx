import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
import "../styles/tailwind-overrides.css";
import { ThemeProvider } from "@/components/theme";

export const metadata: Metadata = {
  title: {
    template: "New GL - %s",
    default: "New GL"
  },
  description: "The GL of accountants, by accountants, for accountants."
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
