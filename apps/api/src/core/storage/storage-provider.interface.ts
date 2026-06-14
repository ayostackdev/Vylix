export const STORAGE_PROVIDER_TOKEN = 'STORAGE_PROVIDER';

export interface StoredFile {
  fileName: string;
  filePath: string;
  fileUrl: string;
}

export interface StorageProvider {
  upload(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    objectPath?: string
  ): Promise<StoredFile>;

  getSignedUrl(path: string, expiresIn?: number): Promise<string>;

  getPublicUrl(path: string): Promise<string>;

  delete(path: string): Promise<void>;
}
