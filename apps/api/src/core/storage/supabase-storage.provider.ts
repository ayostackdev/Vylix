import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { StorageProvider, StoredFile } from './storage-provider.interface';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly logger = new Logger(SupabaseStorageProvider.name);

  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;
  private readonly maxUploadMb: number;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') ?? '';
    this.serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'material';
    this.maxUploadMb = parseInt(this.configService.get<string>('MAX_UPLOAD_MB') ?? '50', 10);
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

    if (!this.supabaseUrl || !this.serviceRoleKey) {
      throw new Error('Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = objectPath ?? `colphy/${new Date().getFullYear()}/${randomUUID()}-${safeName}`;
    const uploadUrl = `${this.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${this.bucket}/${path}`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'content-type': file.mimetype || 'application/pdf',
        'x-upsert': 'true'
      },
      body: file.buffer as unknown as BodyInit
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Supabase upload failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    const fileUrl = await this.getSignedUrl(path, 86400);

    return {
      fileName: file.originalname,
      filePath: path,
      fileUrl
    };
  }

  async getSignedUrl(path: string, expiresIn = 86400): Promise<string> {
    const defaultUrl = `${this.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${this.bucket}/${path}`;

    try {
      const signResp = await fetch(`${this.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${this.bucket}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ expiresIn })
      });

      if (signResp.ok) {
        const data = await signResp.json().catch(() => null) as any;
        return data?.signedURL || data?.signedUrl || data?.signed_url || defaultUrl;
      }
    } catch (err) {
      this.logger.warn(`Signed URL creation failed: ${err}`);
    }

    return defaultUrl;
  }

  async getPublicUrl(path: string): Promise<string> {
    return `${this.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${this.bucket}/${path}`;
  }

  async download(path: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const downloadUrl = `${this.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${this.bucket}/${path}`;
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase download failed with status ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = path.split('/').pop() || 'file';
    return { buffer, mimeType: response.headers.get('content-type') || 'application/octet-stream', fileName };
  }

  async delete(path: string): Promise<void> {
    const deleteUrl = `${this.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${this.bucket}/${path}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Supabase delete failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }
  }
}
