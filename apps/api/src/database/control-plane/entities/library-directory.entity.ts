import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { OrganizationEntity } from './organization.entity';

@Entity('libraries_directory')
export class LibraryDirectoryEntity {
  @PrimaryColumn('uuid')
  library_id!: string;

  @Column('uuid')
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 100, default: 'Asia/Kolkata' })
  timezone!: string;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;
}
