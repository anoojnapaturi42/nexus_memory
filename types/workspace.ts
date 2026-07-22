export type WorkspaceMode = "personal" | "team" | "enterprise";

export type WorkspaceEntity = {
  id: string;
  name: string;
  mode: WorkspaceMode;
};
