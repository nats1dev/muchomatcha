import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
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
    role: session.user.role ?? "OWNER",
    businessId: session.user.businessId,
  };
}

export async function requireBusinessContext() {
  const user = await requireSession();
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
