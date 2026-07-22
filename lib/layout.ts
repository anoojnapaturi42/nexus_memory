import { cn } from "@/lib/utils";

export const layoutTokens = {
  pageWidth: "mx-auto w-full max-w-7xl",
  pagePadding: "px-6 lg:px-10",
  sectionGap: "py-10 lg:py-16",
} as const;

export function layoutContainer(className?: string) {
  return cn(layoutTokens.pageWidth, layoutTokens.pagePadding, className);
}
