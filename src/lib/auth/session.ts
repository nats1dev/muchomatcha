import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { ROLE_RANK, isRoleName, type RoleName } from "@/lib/auth/roles";

// Se reexportan para no romper importaciones existentes desde el servidor.
export { ROLE_RANK, isRoleName, type RoleName };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  businessId: string;
};

export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.businessId) {
    throw new AppError("Debes iniciar sesión", {
      code: "UNAUTHORIZED",
      status: 401,
    });
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    // Fail-closed: un token sin rol reconocible obtiene el minimo privilegio.
    // El valor por defecto NUNCA debe ser OWNER: convertiria cualquier fallo de
    // propagacion del token en una escalada a propietario.
    role: isRoleName(session.user.role) ? session.user.role : "VIEWER",
    businessId: session.user.businessId,
  };
}

/**
 * Exige un rol minimo. Usar en toda Server Action que escriba datos: es el
 * unico control real de permisos, porque ocultar botones en la UI no impide
 * que alguien invoque la accion directamente.
 */
export async function requireRole(min: RoleName): Promise<SessionUser> {
  const user = await requireSession();
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) {
    throw new AppError("No tienes permisos para realizar esta acción", {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  return user;
}

/**
 * Guarda para Server Components (paginas). A diferencia de `requireRole`, que
 * lanza AppError para que la Server Action lo convierta en respuesta, aqui
 * redirigimos: una pagina sin permisos debe llevar al usuario a algun sitio,
 * no dejar la pantalla en blanco.
 */
export async function requirePageRole(
  min: RoleName = "VIEWER",
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.businessId) {
    redirect("/login");
  }
  const role = isRoleName(session.user.role) ? session.user.role : "VIEWER";
  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    redirect("/resumen");
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role,
    businessId: session.user.businessId,
  };
}

export async function requireBusinessContext(min: RoleName = "CASHIER") {
  const user = await requireRole(min);
  const business = await prisma.business.findFirst({
    where: { id: user.businessId, active: true },
  });
  if (!business) {
    throw new AppError("Negocio no encontrado", {
      code: "BUSINESS_NOT_FOUND",
      status: 404,
    });
  }
  return { user, business };
}
