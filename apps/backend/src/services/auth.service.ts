import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';

interface User {
    id: number;
    username: string;
    email: string;
    githubAccessToken: string;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger()
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private readonly configService: ConfigService
    ) { }

    async validateUserFromGithub(profile: any) {
        const { id, email, username } = profile;
        const user = await this.usersService.findOrCreate(profile);
        this.logger.log('user has been found!', user);
        if (!user) {
            throw new Error('User not found or could not be created');
        }

        return { id, email, username };
    }

    async generateJwtToken(user: User) {
        const jwtSecret = this.configService.get('JWT_SECRET');
        console.log(user.githubAccessToken)
        const payload = { sub: user.id, username: user.username, email: user.email, githubAccessToken: user.githubAccessToken };
        return this.jwtService.sign(payload, { secret: jwtSecret, expiresIn: '1h' });
    }
}
