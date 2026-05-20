import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class AlumniService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user is an alumni (graduated)
   */
  async isAlumni(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user?.status === 'ALUMNI' || user?.graduatedAt !== null;
  }

  /**
   * Get alumni by email (check both primary and linked emails)
   */
  async getAlumniByEmail(email: string) {
    const userEmail = await this.prisma.userEmail.findUnique({
      where: { email },
      include: {
        user: true,
      },
    });

    if (!userEmail) return null;

    return userEmail.user.status === 'ALUMNI' ? userEmail.user : null;
  }

  /**
   * Mark user as alumni when they graduate
   */
  async markAsAlumni(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ALUMNI',
        graduatedAt: new Date(),
      },
    });
  }

  /**
   * Get all alumni users
   */
  async getAllAlumni() {
    return this.prisma.user.findMany({
      where: {
        status: 'ALUMNI',
      },
      include: {
        emails: true,
      },
    });
  }

  /**
   * Enable lifetime vault access for alumni
   */
  async enableLifetimeVaultAccess(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ALUMNI',
      },
    });
  }
}
