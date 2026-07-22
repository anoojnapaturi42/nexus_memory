import { ok } from "@/api/response";
import { agentService } from "@/services";

export async function getMockAgentStates() {
  return ok(await agentService.list());
}
