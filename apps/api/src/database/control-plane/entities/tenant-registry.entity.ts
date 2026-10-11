import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';

@Entity('tenant_database_registry')
export class TenantDatabaseRegistryEntity {
  @PrimaryColumn('uuid')
  organization_id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  database_key!: string;

  @Column({ type: 'varchar', length: 255 })
  host!: string;

  @Column({ type: 'int', default: 5432 })
  port!: number;

  @Column({ type: 'varchar', length: 100 })
  database_name!: string;

  @Column({ type: 'varchar', length: 255 })
  secret_reference!: string;

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  schema_version!: string;

  @Column({ type: 'varchar', length: 50, default: 'HEALTHY' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => OrganizationEntity, (org) => org.registry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;
}
