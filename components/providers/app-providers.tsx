"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { env } from "@/lib/env";
import { queryClient } from "@/lib/query-client";
import type { ReactNode } from "react";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [client] = useState(() => queryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme={env.NEXT_PUBLIC_DEFAULT_THEME} enableSystem>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
