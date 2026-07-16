import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RequirementDto {
  @IsString()
  @IsNotEmpty()
  requirement: string;
}

export class AcceptanceCriterionDto {
  @IsString()
  @IsNotEmpty()
  criterion: string;
}

export class CreateTicketDto {
  @IsUUID()
  id: string;

  @IsUUID()
  epicId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementDto)
  requirements: RequirementDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcceptanceCriterionDto)
  acceptance_criteria: AcceptanceCriterionDto[];
}
