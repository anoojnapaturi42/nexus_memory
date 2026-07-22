import { createMockDataset, createMockMemory } from "@/mock/generators";
import type { Memory } from "@/types/domain";

export const mockMemories: Memory[] = createMockDataset(
  (index) =>
    createMockMemory({
      id: `memory_${index + 1}`,
      content: `Memory capture ${index + 1}`,
      sourceApp: index % 2 === 0 ? "gmail" : "calendar",
      importanceScore: 0.55 + index * 0.08,
      relatedEntityIds: [`context_${index + 1}`],
      tags: ["workspace", index % 2 === 0 ? "email" : "calendar"],
    }),
  5,
);
