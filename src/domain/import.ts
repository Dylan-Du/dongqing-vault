import type { CreateSiteInput } from "./site";

export interface ImportPreviewRow {
  id: string;
  input: CreateSiteInput;
  normalizedUrl: string;
  isDuplicate: boolean;
  validationError: string | null;
}

export interface ImportPreview {
  id: string;
  rows: ImportPreviewRow[];
  createdAt: string;
}
