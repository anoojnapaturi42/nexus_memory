import { getMockGoogleContextItemById, getMockGoogleContextItems } from "@/mock/runtime";
import type { GoogleContextItem } from "@/types/domain";
import type { ReadOnlyRepository } from "./base-repository";

export class GoogleContextRepository implements ReadOnlyRepository<GoogleContextItem> {
  async list(): Promise<GoogleContextItem[]> {
    return getMockGoogleContextItems();
  }

  async getById(id: string): Promise<GoogleContextItem | null> {
    return getMockGoogleContextItemById(id);
  }
}

export const googleContextRepository = new GoogleContextRepository();
