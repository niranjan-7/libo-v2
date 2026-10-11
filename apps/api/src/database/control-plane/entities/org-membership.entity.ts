import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { OrganizationEntity } from './organization.entity';
import { OrgRole } from '@library/contracts';

@Entity('org_memberships')
export class OrgMembershipEntity {
  @PrimaryColumn('uuid')
  organization_id!: string;

  @PrimaryColumn('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 50, default: OrgRole.MEMBER })
  role!: OrgRole;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  joined_at!: Date;

  @ManyToOne(() => OrganizationEntity, (org) => org.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ManyToOne(() => UserEntity, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
