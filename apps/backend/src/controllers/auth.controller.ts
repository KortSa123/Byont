import { Response } from 'express';
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) { }

  //Initiates the GitHub OAuth2 login process by triggering the authentication guard.
  @Get('login')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Can be left empty
  }

  //Handles the GitHub OAuth2 authentication callback, generating and setting the JWT token in an HTTP-only cookie, and redirects the user to the dashboard.
  @Get('callback')
  @UseGuards(AuthGuard('github'))
  async authCallback(@Req() req, @Res({ passthrough: true }) res: Response) {
    const user = req.user;
    console.log(user)

    if (!user) {
      throw new BadRequestException('User object is missing in the request');
    }
    const accessToken = await this.authService.generateJwtToken({
      id: user.id,
      username: user.username,
      email: user.email,
      githubAccessToken: user.githubAccessToken,
    });

    // Set the JWT in an HTTP-only cookie
    res.cookie('JWT', accessToken, {
      httpOnly: true,
      secure: false, // Set to true only in production environment
      signed: true,
      // sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    });
    res.redirect('http://localhost:8080/dashboard');
  }
  //Starts the GitHub OAuth2 login process by triggering the authentication guard.
  @Get()
  @UseGuards(AuthGuard('github'))
  async login() {
    //
  }

  //Logs the user out by clearing the JWT cookie and redirecting them to the specified frontend URL, or the default URL if not configured.
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear the JWT cookie
    res.clearCookie('JWT',  {
      httpOnly: true,
      secure: false, // Set to true only in production environment
      signed: true,
      // sameSite: 'strict',
      maxAge: 0,
    });
    const frontendUrl = this.configService.get('FRONTEND_URL');
    res.redirect(frontendUrl ? frontendUrl : 'http://localhost:8080');
  }
}
