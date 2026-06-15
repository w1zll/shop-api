import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuthUserDto {
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

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class CsrfResponseDto {
  @ApiProperty()
  csrfToken!: string;
}
