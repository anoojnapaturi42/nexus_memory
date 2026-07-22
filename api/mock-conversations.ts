import { ok } from "@/api/response";
import { conversationService } from "@/services";

export async function getMockConversations() {
  return ok(await conversationService.list());
}

export async function getMockConversationById(id: string) {
  return ok(await conversationService.getById(id));
}
