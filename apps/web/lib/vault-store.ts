import { del, get, set } from 'idb-keyval';

export type VaultMaterial = {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  departmentCode: string;
  courseId: string;
  topicId: string;
  summary: string;
  questions: string[];
  tips: string[];
  fileBlob: Blob;
  uploadedAt: string;
};

const VAULT_KEY = 'vylix-vault-materials-v1';

export async function getVaultMaterials(): Promise<VaultMaterial[]> {
  return ((await get(VAULT_KEY)) as VaultMaterial[] | undefined) ?? [];
}

export async function saveVaultMaterial(material: VaultMaterial): Promise<VaultMaterial[]> {
  const existing = await getVaultMaterials();
  const updated = [material, ...existing.filter((item) => item.id !== material.id)];
  await set(VAULT_KEY, updated);
  return updated;
}

export async function deleteVaultMaterial(id: string): Promise<VaultMaterial[]> {
  const existing = await getVaultMaterials();
  const updated = existing.filter((item) => item.id !== id);
  await set(VAULT_KEY, updated);
  return updated;
}

export async function clearVaultMaterials(): Promise<void> {
  await del(VAULT_KEY);
}

/**
 * Save a material to the vault and return the updated list + count.
 * Components should call this instead of saveVaultMaterial directly
 * so the backup email prompt hook can intercept the count.
 */
export async function saveToVault(
  material: VaultMaterial
): Promise<{ materials: VaultMaterial[]; count: number }> {
  const updated = await saveVaultMaterial(material);
  return { materials: updated, count: updated.length };
}