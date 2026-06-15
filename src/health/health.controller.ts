import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { DatabaseHealthResponse, HealthResponse, HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: "API is running." })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get("database")
  @ApiOkResponse({ description: "Database connection is healthy." })
  getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    return this.healthService.getDatabaseHealth();
  }
}
