import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  bonusBalanceCents!: number;

  @ApiProperty()
  role!: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}
