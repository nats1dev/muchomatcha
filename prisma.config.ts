import path from "node:path";
import { defineConfig } from "prisma/config";

// Al usar un archivo de configuracion, Prisma deja de cargar `.env` por su
// cuenta. En local lo cargamos aqui; en Railway las variables ya vienen del
// entorno y el archivo no existe, por eso el fallo es silencioso.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Sin archivo .env: se usan las variables del entorno tal cual.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
