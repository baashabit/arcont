export type UiLanguage = "es" | "en";

export type LocalizedText =
  | string
  | {
      es: string;
      en: string;
    };

type TranslationCatalog = Record<string, { es: string; en: string }>;

const textCatalog: TranslationCatalog = {
  "Enterprise operating system": {
    es: "Sistema operativo empresarial",
    en: "Enterprise operating system"
  },
  "Active company": {
    es: "Empresa activa",
    en: "Active company"
  },
  "Multi-tenant visibility, module controls and shared platform patterns live here.": {
    es: "Aquí viven la visibilidad multiempresa, el control de módulos y los patrones compartidos de plataforma.",
    en: "Multi-tenant visibility, module controls and shared platform patterns live here."
  },
  "Start here": {
    es: "Empieza aquí",
    en: "Start here"
  },
  "Setup and AI": {
    es: "Configuración e IA",
    en: "Setup and AI"
  },
  home: {
    es: "inicio",
    en: "home"
  },
  open: {
    es: "abrir",
    en: "open"
  },
  ai: {
    es: "ia",
    en: "ai"
  },
  setup: {
    es: "config",
    en: "setup"
  },
  on: {
    es: "activo",
    en: "on"
  },
  off: {
    es: "oculto",
    en: "off"
  },
  authenticated: {
    es: "autenticado",
    en: "authenticated"
  },
  fallback: {
    es: "respaldo",
    en: "fallback"
  },
  "Role pending": {
    es: "Rol pendiente",
    en: "Role pending"
  },
  "Sign out": {
    es: "Cerrar sesión",
    en: "Sign out"
  },
  "Open navigation": {
    es: "Abrir navegación",
    en: "Open navigation"
  },
  Language: {
    es: "Idioma",
    en: "Language"
  },
  Workspace: {
    es: "Espacio de trabajo",
    en: "Workspace"
  }
};

export function localizedText(es: string, en: string): LocalizedText {
  return { es, en };
}

export function translateText(input: LocalizedText, language: UiLanguage) {
  if (typeof input !== "string") {
    return input[language];
  }

  return textCatalog[input]?.[language] ?? input;
}

export function nextLanguage(current: UiLanguage) {
  return current === "es" ? "en" : "es";
}
