export const MEMBER_ASSET_BUCKET = "member-assets";
export const GENEALOGY_ARCHIVE_BUCKET = "genealogy-archives";

export interface MemberAsset {
  id: string;
  member_id: number;
  bucket: string;
  object_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export function sanitizeStorageFileName(fileName: string) {
  const normalized = fileName.trim().replace(/\s+/g, "-");
  return normalized.replace(/[^A-Za-z0-9._-]/g, "");
}

export function buildMemberAssetPath(memberId: number, fileName: string) {
  const safeName = sanitizeStorageFileName(fileName) || "image";
  return `members/${memberId}/${crypto.randomUUID()}-${safeName}`;
}

export function buildImportArchivePath(fileName: string) {
  const safeName = sanitizeStorageFileName(fileName) || "import.xlsx";
  const date = new Date().toISOString().slice(0, 10);
  return `imports/${date}/${crypto.randomUUID()}-${safeName}`;
}

export function isImageMimeType(mimeType: string) {
  return /^image\//.test(mimeType);
}
