"use client";
import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

// Only light and dark are offered for now. The other skins ("modern",
// "america250", "pretty") are hidden, not deleted -- their CSS still exists,
// so re-adding them here and in theme-toggle.tsx brings them back.
export const AVAILABLE_THEMES = ["light", "dark"] as const;

// next-themes applies whatever theme is stored in localStorage, even one no
// longer in `themes`, so a user who picked a now-hidden skin would be stuck
// on it with no way to switch back. Reset them to the default instead.
function ResetHiddenTheme() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (theme && theme !== "system" && !(AVAILABLE_THEMES as readonly string[]).includes(theme)) {
      setTheme("system");
    }
  }, [theme, setTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem themes={[...AVAILABLE_THEMES]}>
      <ResetHiddenTheme />
      {children}
    </NextThemesProvider>
  );
}
