import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Storage } from 'node-appwrite';
import type { InputFile } from 'node-appwrite/dist/inputFile';
import { randomUUID } from 'crypto';

const { InputFile: InputFileCtor } = require('node-appwrite/file') as { InputFile: typeof InputFile };
import { StorageProvider, StoredFile } from './storage-provider.interface';

@Injectable()
export class AppwriteStorageProvider implements StorageProvider {
  private readonly logger = new Logger(AppwriteStorageProvider.name);

  private readonly storage: Storage;
  private readonly bucketId: string;
  private readonly endpoint: string;
  private readonly maxUploadMb: number;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('APPWRITE_ENDPOINT') ?? '';
    const projectId = this.configService.get<string>('APPWRITE_PROJECT_ID') ?? '';
    const apiKey = this.configService.get<string>('APPWRITE_API_KEY') ?? '';
    this.bucketId = this.configService.get<string>('APPWRITE_STORAGE_BUCKET_ID') ?? '';
    this.endpoint = endpoint.replace(/\/$/, '');
    this.maxUploadMb = parseInt(this.configService.get<string>('MAX_UPLOAD_MB') ?? '50', 10);

    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    this.storage = new Storage(client);
  }

  async upload(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    objectPath?: string
  ): Promise<StoredFile> {
    if (typeof file.size === 'number' && file.size > this.maxUploadMb * 1024 * 1024) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${this.maxUploadMb} MB`);
    }

    const allowedMimePatterns = [
      /^image\//,
      /^application\/pdf$/,
      /^text\//,
      /^application\/msword$/,
      /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
      /^application\/zip$/
    ];

    const isAllowed = allowedMimePatterns.some((rx) => rx.test(file.mimetype || ''));
    if (!isAllowed) {
      throw new BadRequestException('File type is not allowed');
    }

    if (!this.bucketId) {
      throw new Error('Appwrite storage is not configured. Set APPWRITE_STORAGE_BUCKET_ID.');
    }

    const fileId = objectPath ?? randomUUID();
    const inputFile = InputFileCtor.fromBuffer(file.buffer, file.originalname);

    const created = await this.storage.createFile({
      bucketId: this.bucketId,
      fileId,
      file: inputFile,
    });

    const fileUrl = this.getViewUrl(created.$id);

    return {
      fileName: file.originalname,
      filePath: created.$id,
      fileUrl,
    };
  }

  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    return this.getViewUrl(path);
  }

  async getPublicUrl(path: string): Promise<string> {
    return this.getViewUrl(path);
  }

  async download(path: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const fileInfo = await this.storage.getFile({ bucketId: this.bucketId, fileId: path });
    const fileBytes = await this.storage.getFileDownload({ bucketId: this.bucketId, fileId: path });
    return {
      buffer: Buffer.from(fileBytes),
      mimeType: fileInfo.mimeType,
      fileName: fileInfo.name,
    };
  }

  async delete(path: string): Promise<void> {
    await this.storage.deleteFile({
      bucketId: this.bucketId,
      fileId: path,
    });
  }

  private getViewUrl(fileId: string): string {
    return `${this.endpoint}/storage/buckets/${this.bucketId}/files/${fileId}/view`;
  }
}
