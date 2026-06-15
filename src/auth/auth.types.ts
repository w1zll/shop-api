import { UserRole } from "@prisma/client";

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  type: "access" | "refresh";
  sessionId?: string;
}
