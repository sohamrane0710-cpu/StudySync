import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderStepsDto {
  @ApiProperty({
    example: ['dcf7e834-24a4-4d83-8aac-ea8430930f14', '75daacab-aa6e-49f3-b739-6acacf79ce95'],
    description: 'Array of step UUIDs in their desired 0..N-1 order',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  stepIds: string[];
}
