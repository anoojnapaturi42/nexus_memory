import { getMockMemories, getMockMemoryById } from "@/mock/runtime";
import type { Memory } from "@/types/domain";
import type { ReadOnlyRepository } from "./base-repository";

export class MemoryRepository implements ReadOnlyRepository<Memory> {
  async list(): Promise<Memory[]> {
    return getMockMemories();
  }

  async getById(id: string): Promise<Memory | null> {
    return getMockMemoryById(id);
  }
}

export const memoryRepository = new MemoryRepository();
