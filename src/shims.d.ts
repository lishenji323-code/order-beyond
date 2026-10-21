/// <reference types="vite/client" />
declare module '*.css'

interface ImportMetaEnv {
  /** '1' enables the shared trial proxy at /api/story. */
  readonly VITE_TRIAL?: string
  /** Shared invite code, sent as X-Trial-Code when the proxy asks for one. */
  readonly VITE_TRIAL_CODE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
