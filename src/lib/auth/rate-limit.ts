import { prisma } from "@/lib/db";

/**
 * Limite de intentos de inicio de sesion por (correo, IP).
 *
 * Se persiste en la base y no en memoria a proposito: en despliegues con varias
 * instancias cada peticion puede caer en otro proceso, asi que un contador en
 * memoria no limita nada real.
 */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Hash argon2id valido de una contrasena que nadie conoce. Se verifica contra
 * el cuando el correo no existe o la cuenta esta inactiva, para que el tiempo
 * de respuesta sea el mismo en ambos casos: sin esto, la diferencia de latencia
 * (verificar hash vs. no verificar nada) revela que cuentas existen.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$b2ep7Lw/zdhTC5H3RZTfYw$Omh6Jbl/dilQb8lFcuBsc/gYZSvPnbtDwfV4qjnLGTA";

export function dummyPasswordHash() {
  return DUMMY_HASH;
}

/**
 * IP del cliente. Detras del proxy de Railway la unica fuente es la cabecera
 * `x-forwarded-for`; el primer valor es el cliente original.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

function windowStart() {
  return new Date(Date.now() - LOGIN_WINDOW_MS);
}

/** `true` si (correo, IP) agoto los intentos de la ventana actual. */
export async function isLoginBlocked(
  email: string,
  ip: string,
): Promise<boolean> {
  const attempts = await prisma.loginAttempt.count({
    where: { email, ip, attemptedAt: { gte: windowStart() } },
  });
  return attempts >= MAX_LOGIN_ATTEMPTS;
}

export async function recordFailedLogin(email: string, ip: string) {
  await prisma.loginAttempt.create({ data: { email, ip } });
  // Purga oportunista: sin esto la tabla crece sin limite.
  await prisma.loginAttempt.deleteMany({
    where: { attemptedAt: { lt: windowStart() } },
  });
}

/** Un login correcto libera el contador de esa combinacion. */
export async function clearLoginAttempts(email: string, ip: string) {
  await prisma.loginAttempt.deleteMany({ where: { email, ip } });
}
