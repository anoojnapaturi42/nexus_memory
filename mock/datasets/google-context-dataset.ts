import { createMockDataset, createMockGoogleContextItem } from "@/mock/generators";
import type { GoogleContextItem } from "@/types/domain";

export const mockGoogleContextItems: GoogleContextItem[] = createMockDataset(
  (index) =>
    createMockGoogleContextItem({
      id: `context_${index + 1}`,
      type: index % 2 === 0 ? "email" : "doc",
      title: `Context item ${index + 1}`,
      summary: `Summary for context item ${index + 1}.`,
      participants: [`person${index + 1}@example.com`],
      linkedMemoryIds: [`memory_${index + 1}`],
    }),
  5,
);
