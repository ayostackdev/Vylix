import { Controller, Post, Get, Param, Body, UseGuards, Req, Query, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { QnaService } from '../core/services/qna.service';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: {
    sub: string;
    email: string;
  };
}

@Controller('qna')
@UseGuards(JwtAuthGuard)
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  /**
   * Create a question in a topic
   */
  @Post('topics/:topicId/questions')
  async createQuestion(
    @Param('topicId') topicId: string,
    @Body() body: { title: string; content: string },
    @Req() req: AuthRequest
  ) {
    if (!body.title || !body.content) {
      throw new BadRequestException('Title and content are required');
    }

    const question = await this.qnaService.createQuestion(topicId, req.user.sub, {
      title: body.title,
      content: body.content
    });

    return {
      success: true,
      data: question
    };
  }

  /**
   * Get questions in a topic
   */
  @Get('topics/:topicId/questions')
  async getTopicQuestions(
    @Param('topicId') topicId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0
  ) {
    const questions = await this.qnaService.getTopicQuestions(topicId, Number(limit), Number(offset));

    return {
      success: true,
      data: questions
    };
  }

  /**
   * Answer a question
   */
  @Post('questions/:questionId/answers')
  async answerQuestion(
    @Param('questionId') questionId: string,
    @Body() body: { content: string },
    @Req() req: AuthRequest
  ) {
    if (!body.content) {
      throw new BadRequestException('Answer content is required');
    }

    const answer = await this.qnaService.answerQuestion(questionId, req.user.sub, {
      content: body.content
    });

    return {
      success: true,
      data: answer
    };
  }

  /**
   * Mark answer as helpful
   */
  @Post('answers/:answerId/helpful')
  async markHelpful(@Param('answerId') answerId: string, @Req() req: AuthRequest) {
    const answer = await this.qnaService.markAnswerHelpful(answerId, req.user.sub);

    return {
      success: true,
      data: answer
    };
  }

  /**
   * Mark answer as accepted (best solution)
   */
  @Post('questions/:questionId/answers/:answerId/accept')
  async acceptAnswer(
    @Param('questionId') questionId: string,
    @Param('answerId') answerId: string,
    @Req() req: AuthRequest
  ) {
    const answer = await this.qnaService.markAnswerAccepted(answerId, questionId, req.user.sub);

    return {
      success: true,
      data: answer
    };
  }

  /**
   * Get trending questions
   */
  @Get('trending')
  async getTrendingQuestions(@Query('limit') limit = 5) {
    const questions = await this.qnaService.getTrendingQuestions(Number(limit));

    return {
      success: true,
      data: questions
    };
  }

  /**
   * Search questions
   */
  @Get('search')
  async searchQuestions(
    @Query('q') query: string,
    @Query('topicId') topicId?: string,
    @Query('limit') limit = 20
  ) {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    const questions = await this.qnaService.searchQuestions(query, topicId, Number(limit));

    return {
      success: true,
      data: questions
    };
  }

  /**
   * Get top answerers in a topic
   */
  @Get('topics/:topicId/top-answerers')
  async getTopAnswerers(@Param('topicId') topicId: string, @Query('limit') limit = 10) {
    const answerers = await this.qnaService.getTopAnswerersInTopic(topicId, Number(limit));

    return {
      success: true,
      data: answerers
    };
  }
}
