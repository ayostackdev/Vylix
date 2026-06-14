import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadgeService } from './badge.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  badge: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  userBadge: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockPrisma)),
};

describe('BadgeService', () => {
  let service: BadgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BadgeService>(BadgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
