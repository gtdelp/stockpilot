import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Si es `true`, el interceptor de errores no muestra el aviso global. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Contexto para peticiones cuyo error gestiona el propio llamador. */
export function silentContext(): HttpContext {
  return new HttpContext().set(SILENT_ERRORS, true);
}
