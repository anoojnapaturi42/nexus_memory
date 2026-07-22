import { ok } from "@/api/response";
import { googleContextService } from "@/services";

export async function getMockGoogleContextItems() {
  return ok(await googleContextService.list());
}

export async function getMockGoogleContextItemById(id: string) {
  return ok(await googleContextService.getById(id));
}
