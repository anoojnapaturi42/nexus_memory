import { ok } from "@/api/response";
import { memoryService } from "@/services";

export async function getMockMemories() {
  return ok(await memoryService.list());
}

export async function getMockMemoryById(id: string) {
  return ok(await memoryService.getById(id));
}
