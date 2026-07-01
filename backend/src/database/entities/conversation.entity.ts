import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryColumn({ type: 'uuid' })
  uuid!: string;

  @Column({ type: 'varchar', length: 255, default: null, nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', length: 500, default: null })
  title!: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  messages!: Record<string, unknown>[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
