import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[12px] border border-border bg-card p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Image
          src="/logo-oficial.png"
          alt="Mucho Matcha — Ceremonial Tea House"
          width={300}
          height={108}
          priority
          className="mx-auto h-auto w-full max-w-[300px] object-contain"
        />
        <h1 className="mt-5 text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control operativo y financiero de tu cafetería
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
