import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

import {
  SEARCH_SUGGESTIONS_DEFAULT_LIMIT,
  SEARCH_SUGGESTIONS_MAX_LIMIT,
} from "../catalog.constants";

export class SearchSuggestionsQueryDto {
  @ApiPropertyOptional({ example: "науш" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: SEARCH_SUGGESTIONS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: SEARCH_SUGGESTIONS_MAX_LIMIT,
    default: SEARCH_SUGGESTIONS_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SEARCH_SUGGESTIONS_MAX_LIMIT)
  limit?: number = SEARCH_SUGGESTIONS_DEFAULT_LIMIT;
}
