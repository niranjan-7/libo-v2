import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AuthResponse, UserDto } from '@library/contracts';
import { UserEntity } from '../../database/control-plane/entities/user.entity';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(OrgMembershipEntity)
    private readonly membershipRepo: Repository<OrgMembershipEntity>,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      display_name: dto.displayName,
      password_hash: passwordHash,
      status: 'ACTIVE',
    });

    const savedUser = await this.userRepo.save(user);
    const token = this.generateToken(savedUser.user_id, savedUser.email);

    return {
      user: this.mapToUserDto(savedUser),
      token,
      organizations: [],
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is suspended or inactive');
    }

    const token = this.generateToken(user.user_id, user.email);
    const organizations = await this.getUserOrganizations(user.user_id);

    return {
      user: this.mapToUserDto(user),
      token,
      organizations,
    };
  }

  async getMe(userId: string): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    const token = this.generateToken(user.user_id, user.email);
    const organizations = await this.getUserOrganizations(user.user_id);

    return {
      user: this.mapToUserDto(user),
      token,
      organizations,
    };
  }

  private generateToken(userId: string, email: string): string {
    const secret = this.configService.get<string>('JWT_SECRET', 'dev_jwt_secret_minimum_32_characters_key_here');
    return jwt.sign(
      {
        sub: userId,
        email,
      },
      secret,
      { expiresIn: '7d' },
    );
  }

  private async getUserOrganizations(userId: string): Promise<AuthResponse['organizations']> {
    const memberships = await this.membershipRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
    });

    return memberships
      .filter((m) => m.organization != null)
      .map((m) => ({
        organization: {
          organizationId: m.organization!.organization_id,
          name: m.organization!.name,
          slug: m.organization!.slug,
          status: m.organization!.status,
          createdAt: m.organization!.created_at.toISOString(),
        },
        role: m.role,
      }));
  }

  private mapToUserDto(user: UserEntity): UserDto {
    return {
      userId: user.user_id,
      email: user.email,
      displayName: user.display_name,
      status: user.status,
      createdAt: user.created_at.toISOString(),
    };
  }
}
