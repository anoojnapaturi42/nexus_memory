import type { GoogleOAuthProvider, GoogleOAuthScope } from "@/types/auth";

export type StoredGoogleTokenRecord = {
  provider: GoogleOAuthProvider;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  expiryDate: number | null;
  scopes: GoogleOAuthScope[];
  connectedAt: string;
};

export interface GoogleTokenVault {
  save(sessionId: string, record: StoredGoogleTokenRecord): void;
  get(sessionId: string): StoredGoogleTokenRecord | null;
  delete(sessionId: string): void;
}

declare global {
  // eslint-disable-next-line no-var
  var __googleNexusMemoryTokenVault: Map<string, StoredGoogleTokenRecord> | undefined;
}

const vault = globalThis.__googleNexusMemoryTokenVault ?? new Map<string, StoredGoogleTokenRecord>();
globalThis.__googleNexusMemoryTokenVault = vault;

export const memoryGoogleTokenVault: GoogleTokenVault = {
  save(sessionId, record) {
    vault.set(sessionId, record);
  },
  get(sessionId) {
    return vault.get(sessionId) ?? null;
  },
  delete(sessionId) {
    vault.delete(sessionId);
  },
};
