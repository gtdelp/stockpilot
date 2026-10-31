import { DOCUMENT } from '@angular/common';
import { Injectable, RendererFactory2, effect, inject, signal } from '@angular/core';

/** Tema de color de la interfaz. */
export type ThemeMode = 'light' | 'dark';

/** Clave de `localStorage` con la preferencia de tema. */
const STORAGE_KEY = 'stockpilot.theme';

/**
 * Gestiona el modo claro/oscuro: parte de la preferencia del sistema
 * (`prefers-color-scheme`) y recuerda la elección del usuario.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  /** Tema activo. */
  readonly mode = signal<ThemeMode>(this.initialMode());

  constructor() {
    effect(() => {
      const dark = this.mode() === 'dark';
      const root = this.document.documentElement;
      if (dark) {
        this.renderer.addClass(root, 'ion-palette-dark');
      } else {
        this.renderer.removeClass(root, 'ion-palette-dark');
      }
      const meta = this.document.querySelector('meta[name="theme-color"]');
      if (meta) {
        this.renderer.setAttribute(meta, 'content', dark ? '#111827' : '#ffffff');
      }
    });
  }

  /** `true` si el modo oscuro está activo. */
  isDark(): boolean {
    return this.mode() === 'dark';
  }

  /** Alterna entre claro y oscuro y guarda la preferencia. */
  toggle(): void {
    const next: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.mode.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento disponible: el tema se mantiene durante la sesión
    }
  }

  private initialMode(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // Ignorado: se usa la preferencia del sistema
    }
    const prefersDark =
      this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    return prefersDark ? 'dark' : 'light';
  }
}
