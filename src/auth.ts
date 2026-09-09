import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  clearLoginAttempts,
  clientIpFrom,
  dummyPasswordHash,
  isLoginBlocked,
  recordFailedLogin,
} from "@/lib/auth/rate-limit";

/**
 * Codigo propio para distinguir "bloqueado por intentos" de "credenciales
 * incorrectas" en el formulario, sin revelar si la cuenta existe.
 */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

const credentialsSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface User {
    role?: string;
    businessId?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      businessId: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    businessId?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = clientIpFrom(request.headers);
        if (await isLoginBlocked(email, ip)) {
          throw new RateLimitedSignin();
        }

        const user = await prisma.user.findFirst({
          where: { email, active: true },
        });

        // Se verifica SIEMPRE un hash, aunque el usuario no exista o este
        // inactivo: argon2id tarda cientos de milisegundos y saltarselo
        // delataria por diferencia de latencia que correos estan registrados.
        const valid = await verifyPassword(
          user?.passwordHash ?? dummyPasswordHash(),
          password,
        );

        if (!user || !valid) {
          await recordFailedLogin(email, ip);
          return null;
        }

        await clearLoginAttempts(email, ip);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Fail-closed: sin rol en el token se asume el minimo privilegio.
        // Un `?? "OWNER"` aqui convertiria cualquier token incompleto en
        // una cuenta de propietario.
        session.user.role = (token.role as string) ?? "VIEWER";
        session.user.businessId = token.businessId as string;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = !!session?.user;
      const isAuthPage = path.startsWith("/login");
      const isPublic =
        isAuthPage ||
        path.startsWith("/api/auth") ||
        path.startsWith("/_next") ||
        path === "/favicon.ico";

      if (isPublic) {
        if (isLoggedIn && isAuthPage) {
          return Response.redirect(new URL("/resumen", request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        const login = new URL("/login", request.nextUrl);
        login.searchParams.set("callbackUrl", path);
        return Response.redirect(login);
      }
      return true;
    },
  },
  trustHost: true,
});
