import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { OrgMembershipEntity } from './org-membership.entity';
import { TenantDatabaseRegistryEntity } from './tenant-registry.entity';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => OrgMembershipEntity, (membership) => membership.organization)
  memberships?: OrgMembershipEntity[];

  @OneToOne(() => TenantDatabaseRegistryEntity, (registry) => registry.organization)
  registry?: TenantDatabaseRegistryEntity;
}
