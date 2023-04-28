import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  Response,
} from '@nestjs/common';
import { Request } from 'express';
import { GithubService } from '../services/github.service';
import { JwtService } from '@nestjs/jwt';
import { Octokit } from '@octokit/rest';
import { JwtPayload } from 'src/decorators/jwt-payload.decorator';
import { User } from 'src/types/user.type';
import { CreateWebhookDto } from 'src/DTO/create-webhook.dto';
import { PrismaClient } from '@prisma/client';
import { UsersService } from 'src/services/users.service';

@Controller('github')
export class GithubController {
  constructor(
    private readonly githubService: GithubService,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService
  ) {}

  @Get('sol-files')
  async getSolFiles(@Req() req: Request) {
    const jwtToken = req.signedCookies.JWT;

    if (!jwtToken) {
      throw new UnauthorizedException('JWT token is missing');
    }

    const payload = this.jwtService.decode(jwtToken) as any;
    const accessToken = await this.userService.getAccessToken(payload.email);

    if (!accessToken) {
      throw new UnauthorizedException('GitHub access token is missing');
    }

    const repoName = 'webhooksrepo'; // Replace with the desired repository name
    return this.githubService.getSolFiles(accessToken, repoName);
  }

  @Get('repos')
  async getRepos(@JwtPayload() payload: any): Promise<string[]> {
    console.log('payload', payload);
    if (!payload) {
      throw new UnauthorizedException('JWT token is missing');
    }

    const accessToken = await this.userService.getAccessToken(payload.email);

    if (!accessToken) {
      throw new UnauthorizedException('GitHub access token is missing');
    }

    return await this.githubService.getRepos(accessToken);
  }

  @Post('add-webhook')
  async createWebhook(
    @Req() req: Request,
    @Response() res: any,
    @Body() body: CreateWebhookDto
  ) {
    const repoName = body.repoName;
    console.log('body', body);
    if (!req['customUser']) {
      throw new UnauthorizedException('User not found');
    }

    const user: User = req['customUser'];
    const accessToken = await this.userService.getAccessToken(user.email);
    console.log(user);
    if (!user || !accessToken) {
      throw new UnauthorizedException(
        'User does not exist or GitHub access token is missing'
      );
    }

    try {
      const octokit = new Octokit({
        auth: accessToken,
      });
      if (octokit) {
        console.log('octokit created');
      }

      try {
        const response = await octokit.request(
          'POST /repos/{owner}/{repo}/hooks',
          {
            owner: user.username,
            repo: repoName,
            name: 'web',
            active: true,
            events: ['push', 'pull_request'],
            config: {
              url: ' https://2902-2a02-a210-2b45-5200-2dbd-ee44-1e75-c796.ngrok-free.app/webhook/github-events', //Create a NGROK tunnel and replace this with your ngrok URL
              content_type: 'json',
              insecure_ssl: '0',
            },
            headers: {
              accept: 'application/vnd.github+json',
            },
          }
        );

        if (response.status === 201) {
          console.log('Webhook created successfully:', response.data);
          return res
            .status(201)
            .json({
              data: response.data,
              message: 'Webhook created successfully',
            });
        } else {
          console.log('Error creating webhook:', response);
        }
      } catch (error) {
        console.error('Error creating webhook:', error);
      }
    } catch (error) {
      console.log(error);
      throw new HttpException('Invalid JWT token', HttpStatus.UNAUTHORIZED);
    }
  }
}
