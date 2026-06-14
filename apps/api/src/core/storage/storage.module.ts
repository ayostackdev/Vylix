import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER_TOKEN } from './storage-provider.interface';
import { SupabaseStorageProvider } from './supabase-storage.provider';
import { AppwriteStorageProvider } from './appwrite-storage.provider';

@Global()
@Module({})
export class StorageModule {
  static register(): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule],
      providers: [
        SupabaseStorageProvider,
        AppwriteStorageProvider,
        {
          provide: STORAGE_PROVIDER_TOKEN,
          useFactory: (
            configService: ConfigService,
            supabase: SupabaseStorageProvider,
            appwrite: AppwriteStorageProvider,
          ): SupabaseStorageProvider | AppwriteStorageProvider => {
            const provider = configService.get<string>('STORAGE_PROVIDER') ?? 'supabase';
            return provider === 'appwrite' ? appwrite : supabase;
          },
          inject: [ConfigService, SupabaseStorageProvider, AppwriteStorageProvider],
        },
      ],
      exports: [STORAGE_PROVIDER_TOKEN],
    };
  }
}
