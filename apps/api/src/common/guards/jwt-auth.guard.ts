import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET', 'dev_jwt_secret_minimum_32_characters_key_here');
      const payload = jwt.verify(token, secret) as { sub: string; email: string };
      
      const user: AuthenticatedUser = {
        userId: payload.sub,
        email: payload.email,
      };

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractToken(request: any): string | null {
    // 1. Check Authorization Bearer header
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    // 2. Check HttpOnly cookie
    if (request.cookies && request.cookies.auth_token) {
      return request.cookies.auth_token;
    }

    return null;
  }
}
