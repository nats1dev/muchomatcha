import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Café Control — Mucho Matcha",
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
      className={`${geistSans.variable} h-full antialiased`}
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
