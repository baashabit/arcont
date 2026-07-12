import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { loadAppData } from "@/lib/app-data";

const uiFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "ARCONT Suite",
  description: "Enterprise web foundation for the modular ARCONT platform."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialData = await loadAppData();

  return (
    <html lang="es">
      <body className={`${uiFont.variable} ${monoFont.variable}`}>
        <AppStateProvider initialData={initialData}>{children}</AppStateProvider>
      </body>
    </html>
  );
}
