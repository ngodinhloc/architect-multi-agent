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

  @Column({ type: 'varchar', length: 255, nullable: false })
  username!: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  title!: string;

  @Column({ type: 'jsonb', default: '[]' })
  messages!: Record<string, unknown>[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
