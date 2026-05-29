import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { StreakService } from '../core/services/streak.service';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: {
    sub: string;
    email: string;
  };
}

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly streakService: StreakService) {}

  /**
   * Daily check-in - maintains streak and awards points
   */
  @Post('check-in')
  async checkIn(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const result = await this.streakService.checkInDaily(userId);
    return {
      success: true,
      message: `Checked in! Current streak: ${result.currentStreak} days`,
      data: result
    };
  }

  /**
   * Get user's streak data
   */
  @Get('streak')
  async getStreak(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const streakData = await this.streakService.getStreakData(userId);
    return {
      success: true,
      data: streakData
    };
  }

  /**
   * Get user's total points
   */
  @Get('points')
  async getPoints(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const totalPoints = await this.streakService.getUserTotalPoints(userId);
    return {
      success: true,
      data: {
        totalPoints
      }
    };
  }

  /**
   * Get user's points history
   */
  @Get('points/history')
  async getPointsHistory(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const history = await this.streakService.getPointsHistory(userId, 50);
    return {
      success: true,
      data: history
    };
  }

  /**
   * Get top users by streak (leaderboard)
   */
  @Get('leaderboard/streaks')
  async getStreakLeaderboard() {
    const users = await this.streakService.getTopStreakUsers(10);
    return {
      success: true,
      data: users
    };
  }

  /**
   * Get top users by points (leaderboard)
   */
  @Get('leaderboard/points')
  async getPointsLeaderboard() {
    const users = await this.streakService.getTopPointsUsers(10);
    return {
      success: true,
      data: users
    };
  }
}
