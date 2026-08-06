import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { OpenAIErrorBody } from "../types/chat.js";

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly type: string;
  readonly code: string | null;
  readonly param: string | null;

  constructor(opts: {
    status: ContentfulStatusCode;
    message: string;
    type?: string;
    code?: string | null;
    param?: string | null;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.status = opts.status;
    this.type = opts.type ?? defaultType(opts.status);
    this.code = opts.code ?? null;
    this.param = opts.param ?? null;
  }

  toJSON(): OpenAIErrorBody {
    return {
      error: {
        message: this.message,
        type: this.type,
        code: this.code,
        param: this.param,
      },
    };
  }
}

function defaultType(status: number): string {
  if (status === 401) return "authentication_error";
  if (status === 402) return "insufficient_quota";
  if (status === 429) return "rate_limit_error";
  if (status === 400) return "invalid_request_error";
  return "api_error";
}

export function openaiError(
  status: ContentfulStatusCode,
  message: string,
  code?: string | null,
  param?: string | null,
): AppError {
  return new AppError({ status, message, code, param });
}
