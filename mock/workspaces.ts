import type { WorkspaceEntity } from "@/types/workspace";

export const mockWorkspaces: WorkspaceEntity[] = [
  {
    id: "workspace_personal",
    name: "Personal Nexus",
    mode: "personal",
  },
  {
    id: "workspace_team",
    name: "Team Nexus",
    mode: "team",
  },
];
