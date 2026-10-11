import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { OrgRole } from '@library/contracts';

@Entity('org_invitations')
export class OrgInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  invitation_id!: string;

  @Column('uuid')
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 50, default: OrgRole.MEMBER })
  proposed_role!: OrgRole;

  @Column({ type: 'uuid', nullable: true })
  target_library_id?: string | null;

  @Column({ type: 'varchar', length: 255 })
  token_hash!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;
}
