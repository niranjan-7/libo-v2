import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrgMembershipEntity } from './org-membership.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => OrgMembershipEntity, (membership) => membership.user)
  memberships?: OrgMembershipEntity[];
}
