import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class NewChatDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  username?: string;
}
