import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mucho Matcha",
  description: "Control operativo y financiero de cafetería",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` solo silencia los atributos de <html> y <body>,
    // no los de sus hijos: las extensiones del navegador (modo lectura, gestores
    // de temas) inyectan clases y `data-*` en estas dos etiquetas antes de que
    // React hidrate, y esa diferencia no es un error de la aplicacion.
    <html
      lang="es"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
