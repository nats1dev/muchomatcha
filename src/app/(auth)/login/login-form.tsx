"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Solo permite rutas internas como destino tras el login. Sin esto,
 * `/login?callbackUrl=https://sitio-malicioso.tld` redirige fuera del sitio
 * justo despues de autenticar, que es el patron clasico de phishing.
 */
function safeCallbackUrl(raw: string | null): string {
  const fallback = "/resumen";
  if (!raw) return fallback;
  // "//host" y "/\host" son URLs protocol-relative: salen del dominio.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      // `code` viene del error lanzado en `authorize`. El mensaje de bloqueo no
      // revela si la cuenta existe: se activa igual con correos inexistentes.
      setError(
        res.code === "rate_limited"
          ? "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo."
          : "Correo o contraseña incorrectos",
      );
      return;
    }
    router.push(safeCallbackUrl(searchParams.get("callbackUrl")));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Entrar"}
      </Button>
    </form>
  );
}
