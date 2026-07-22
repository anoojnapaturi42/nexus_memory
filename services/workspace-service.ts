import { BaseService } from "@/services/base-service";
import type { WorkspaceEntity } from "@/types/workspace";

export class WorkspaceService extends BaseService {
  async list(): Promise<WorkspaceEntity[]> {
    return [];
  }
}
