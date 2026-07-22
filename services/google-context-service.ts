import { BaseService } from "@/services/base-service";
import { googleContextRepository, type GoogleContextRepository } from "@/mock/repositories";
import type { GoogleContextItem } from "@/types/domain";

export class GoogleContextService extends BaseService {
  constructor(private readonly repository: GoogleContextRepository = googleContextRepository) {
    super("/api/google-context");
  }

  async list(): Promise<GoogleContextItem[]> {
    return this.repository.list();
  }

  async getById(id: string): Promise<GoogleContextItem | null> {
    return this.repository.getById(id);
  }
}

export const googleContextService = new GoogleContextService();
