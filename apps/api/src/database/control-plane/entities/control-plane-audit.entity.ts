import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

@Entity('control_plane_audit_logs')
export class ControlPlaneAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  audit_id!: string;

  @Column('uuid')
  organization_id!: string;

  @Column('uuid')
  actor_user_id!: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_user_id' })
  actor?: UserEntity;
}
