import { ZodError } from "zod";

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
  // Validacion de la frontera (`src/app/actions/schemas.ts`): se devuelve el
  // detalle por campo para que el formulario lo pinte junto a cada input, en
  // vez de un "error inesperado" que no dice que corregir.
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.map(String).join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return {
      ok: false,
      message: error.issues[0]?.message ?? "Datos inválidos",
      code: "VALIDATION_ERROR",
      fieldErrors,
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
