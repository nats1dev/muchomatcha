"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { writeAudit } from "@/modules/audit/service";
import { AppError, toActionError, type ActionResult } from "@/lib/errors";
import { ROLE_RANK, type RoleName } from "@/lib/auth/roles";

const PASSWORD_MIN = 10;

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(200);

const createUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido").max(200),
  role: z.enum(["OWNER", "ADMIN", "CASHIER", "VIEWER"]),
  password: passwordSchema,
});

/**
 * Impide la escalada de privilegios: nadie puede crear o asignar un rol
 * superior al suyo. Sin esta regla un ADMIN podria crearse una cuenta OWNER.
 */
function assertCanAssignRole(actorRole: RoleName, targetRole: RoleName) {
  if (ROLE_RANK[targetRole] > ROLE_RANK[actorRole]) {
    throw new AppError(
      "No puedes asignar un rol superior al tuyo",
      { code: "ROLE_ESCALATION", status: 403 },
    );
  }
}

export async function createUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string; email: string }>> {
  try {
    const actor = await requireRole("ADMIN");
    const input = createUserSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      password: formData.get("password"),
    });

    assertCanAssignRole(actor.role, input.role);

    const passwordHash = await hashPassword(input.password);

    let created;
    try {
      created = await prisma.user.create({
        data: {
          businessId: actor.businessId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        },
        select: { id: true, email: true, name: true, role: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(`Ya existe un usuario con el correo "${input.email}"`, {
          code: "DUPLICATE_EMAIL",
          fieldErrors: { email: ["Este correo ya está registrado"] },
        });
      }
      throw e;
    }

    await writeAudit(prisma, {
      businessId: actor.businessId,
      userId: actor.id,
      action: "CREATE",
      entityType: "user",
      entityId: created.id,
      // Nunca se registra el hash ni la contrasena en la auditoria.
      afterData: { email: created.email, name: created.name, role: created.role },
    });

    revalidatePath("/configuracion/usuarios");
    return { ok: true, data: { id: created.id, email: created.email } };
  } catch (e) {
    return toActionError(e);
  }
}

const toggleSchema = z.object({ userId: z.string().uuid() });

export async function toggleUserActiveAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ active: boolean; name: string }>> {
  try {
    const actor = await requireRole("ADMIN");
    const { userId } = toggleSchema.parse({ userId: formData.get("userId") });

    const target = await prisma.user.findFirst({
      where: { id: userId, businessId: actor.businessId },
    });
    if (!target) throw new AppError("Usuario no encontrado", { status: 404 });

    // Desactivarse a uno mismo deja al operador fuera de su propia sesion.
    if (target.id === actor.id) {
      throw new AppError("No puedes desactivar tu propia cuenta", {
        code: "SELF_DEACTIVATION",
      });
    }
    assertCanAssignRole(actor.role, target.role);

    // Quedarse sin ningun propietario activo hace el negocio inadministrable.
    if (target.active && target.role === "OWNER") {
      const activeOwners = await prisma.user.count({
        where: { businessId: actor.businessId, role: "OWNER", active: true },
      });
      if (activeOwners <= 1) {
        throw new AppError(
          "No puedes desactivar al único propietario activo",
          { code: "LAST_OWNER" },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { active: !target.active },
      select: { id: true, active: true, name: true },
    });

    await writeAudit(prisma, {
      businessId: actor.businessId,
      userId: actor.id,
      action: updated.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "user",
      entityId: updated.id,
      beforeData: { active: target.active },
      afterData: { active: updated.active },
    });

    revalidatePath("/configuracion/usuarios");
    return { ok: true, data: { active: updated.active, name: updated.name } };
  } catch (e) {
    return toActionError(e);
  }
}

const resetSchema = z.object({
  userId: z.string().uuid(),
  password: passwordSchema,
});

/** Restablece la contrasena de otro usuario (accion de administrador). */
export async function resetPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireRole("ADMIN");
    const input = resetSchema.parse({
      userId: formData.get("userId"),
      password: formData.get("password"),
    });

    const target = await prisma.user.findFirst({
      where: { id: input.userId, businessId: actor.businessId },
    });
    if (!target) throw new AppError("Usuario no encontrado", { status: 404 });
    assertCanAssignRole(actor.role, target.role);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(input.password) },
    });

    await writeAudit(prisma, {
      businessId: actor.businessId,
      userId: actor.id,
      action: "RESET_PASSWORD",
      entityType: "user",
      entityId: target.id,
    });

    revalidatePath("/configuracion/usuarios");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

const changeOwnSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: passwordSchema,
});

/** Cambio de contrasena propia. Disponible para cualquier usuario con sesion. */
export async function changeOwnPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const input = changeOwnSchema.parse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
    });

    const record = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const valid = await verifyPassword(record.passwordHash, input.currentPassword);
    if (!valid) {
      throw new AppError("La contraseña actual no es correcta", {
        code: "INVALID_PASSWORD",
        fieldErrors: { currentPassword: ["Contraseña incorrecta"] },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });

    await writeAudit(prisma, {
      businessId: user.businessId,
      userId: user.id,
      action: "CHANGE_PASSWORD",
      entityType: "user",
      entityId: user.id,
    });

    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
