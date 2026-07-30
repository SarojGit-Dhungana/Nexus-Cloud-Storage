import { createContext, useContext } from "react";

export type UploadGuard = {
  upload: (files: File[], parent?: string) => Promise<void>;
  storageFull: boolean;
};

export const UploadGuardContext = createContext<UploadGuard | null>(null);

export function useUploadGuard() {
  const ctx = useContext(UploadGuardContext);
  if (!ctx) throw new Error("Upload guard unavailable");
  return ctx;
}
