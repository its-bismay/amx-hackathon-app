/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SBF_URL: string;
  readonly VITE_AI_PLATFORM_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
