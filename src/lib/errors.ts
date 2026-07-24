export class AppError extends Error {
  code: string;
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    opts?: {
      code?: string;
      status?: number;
      fieldErrors?: Record<string, string[]>;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.code = opts?.code ?? "APP_ERROR";
    this.status = opts?.status ?? 400;
    this.fieldErrors = opts?.fieldErrors;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toActionError(error: unknown): {
  ok: false;
  message: string;
  code: string;
  fieldErrors?: Record<string, string[]>;
} {
  if (isAppError(error)) {
    return {
      ok: false,
      message: error.message,
      code: error.code,
      fieldErrors: error.fieldErrors,
    };
  }
  console.error(error);
  return {
    ok: false,
    message: "Ocurrió un error inesperado. Intenta de nuevo.",
    code: "INTERNAL_ERROR",
  };
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | {
      ok: false;
      message: string;
      code: string;
      fieldErrors?: Record<string, string[]>;
    };
