/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_VAPID_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
