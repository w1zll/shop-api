import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

function getExceptionPayload(exception: HttpException) {
  const response = exception.getResponse();

  if (typeof response === "string") {
    return {
      error: exception.name,
      message: response,
    };
  }

  if (typeof response === "object") {
    const body = response as { error?: string; message?: string | string[] };
    return {
      error: body.error ?? exception.name,
      message: body.message ?? exception.message,
    };
  }

  return {
    error: exception.name,
    message: exception.message,
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? getExceptionPayload(exception)
        : {
            error: "InternalServerError",
            message: "Unexpected internal server error",
          };

    const body: ErrorResponseBody = {
      statusCode: status,
      error: payload.error,
      message: payload.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
