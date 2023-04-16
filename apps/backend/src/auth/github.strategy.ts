import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../services/auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger();
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID'),
      clientSecret: configService.get('GITHUB_CLIENT_SECRET'),
      callbackURL: 'http://localhost:3000/auth/callback',
      scope: ['repo'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const user = {
      accessToken,
      profile,
    };
    return user;
  }
}
