import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FeatureDto {
  @IsString()
  @IsNotEmpty()
  feature: string;
}

export class ComponentDto {
  @IsString()
  @IsNotEmpty()
  tech: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureDto)
  features: FeatureDto[];
}

export class SolutionDto {
  @IsString()
  @IsNotEmpty()
  architecture: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  components: ComponentDto[];
}

export class RequirementDto {
  @IsString()
  @IsNotEmpty()
  requirement: string;
}

export class CreateEpicDto {
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementDto)
  requirements: RequirementDto[];

  @ValidateNested()
  @Type(() => SolutionDto)
  solution: SolutionDto;
}
