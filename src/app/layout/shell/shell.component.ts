import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonMenu } from '@ionic/angular/ion-menu';
import { IonMenuButton } from '@ionic/angular/ion-menu-button';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { IonPopover } from '@ionic/angular/ion-popover';
import { IonSplitPane } from '@ionic/angular/ion-split-pane';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';
import { AppNotification, ROLE_LABELS, Role } from '../../core/models';
import { RealtimeProvider } from '../../core/realtime/realtime-provider';
import { ThemeService } from '../../core/services/theme.service';
import { formatRelative, initials } from '../../core/utils/format';

/** Entrada del menú de navegación. */
interface NavItem {
  /** Texto visible. */
  label: string;
  /** Ruta de navegación. */
  url: string;
  /** Nombre del icono de Ionicons. */
  icon: string;
  /** Roles con acceso. */
  roles: Role[];
}

/** Secciones principales del menú. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Cuadro de mando', url: '/panel', icon: 'analytics-outline', roles: ['admin'] },
  { label: 'Productos', url: '/productos', icon: 'cube-outline', roles: ['admin', 'user'] },
  { label: 'Pedidos', url: '/pedidos', icon: 'receipt-outline', roles: ['admin', 'user'] },
  { label: 'Usuarios', url: '/usuarios', icon: 'people-outline', roles: ['admin'] },
  { label: 'Categorías y proveedores', url: '/maestros', icon: 'albums-outline', roles: ['admin'] },
];

/** Secciones de la cuenta. */
const SECONDARY_ITEMS: NavItem[] = [
  { label: 'Mi perfil', url: '/perfil', icon: 'person-circle-outline', roles: ['admin', 'user'] },
  { label: 'Ayuda', url: '/ayuda', icon: 'help-buoy-outline', roles: ['admin', 'user'] },
];

/**
 * Estructura principal autenticada: menú lateral (fijo en escritorio, deslizable
 * en móvil), barra superior con notificaciones en tiempo real y tema, y el
 * contenido de la ruta activa (cada `ion-content` actúa como landmark `main`).
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IonSplitPane,
    IonMenu,
    IonContent,
    IonMenuToggle,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonIcon,
    IonBadge,
    IonPopover,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeService);
  private readonly realtime = inject(RealtimeProvider);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Modo demostración (sin servicios externos). */
  protected readonly demoMode = environment.demoMode;

  /** Notificaciones en tiempo real del usuario. */
  protected readonly notifications = signal<AppNotification[]>([]);
  /** Número de notificaciones sin leer. */
  protected readonly unread = computed(
    () => this.notifications().filter((item) => !item.read).length,
  );

  /** Entradas principales visibles para el rol actual. */
  protected readonly navItems = computed(() => filterByRole(NAV_ITEMS, this.auth.role()));
  /** Entradas secundarias visibles para el rol actual. */
  protected readonly secondaryItems = computed(() =>
    filterByRole(SECONDARY_ITEMS, this.auth.role()),
  );
  /** Iniciales para el avatar. */
  protected readonly initials = computed(() => initials(this.auth.profile()?.fullName ?? ''));
  /** Rol legible. */
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });

  private readonly user$ = toObservable(this.auth.profile);

  /** Se suscribe a las notificaciones del usuario actual (se cancela al destruir el shell). */
  ngOnInit(): void {
    this.user$
      .pipe(
        switchMap((profile) => (profile ? this.realtime.notifications$(profile.id) : EMPTY)),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => this.notifications.set(items));
  }

  /** Marca una notificación como leída. */
  protected async markAsRead(item: AppNotification): Promise<void> {
    const profile = this.auth.profile();
    if (profile && !item.read) {
      await this.realtime.markAsRead(profile.id, item.id);
    }
  }

  /** Tiempo relativo de una notificación. */
  protected relative(iso: string): string {
    return formatRelative(iso);
  }

  /** Cierra la sesión y vuelve al login. */
  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

/** Filtra las entradas visibles para un rol. */
function filterByRole(items: NavItem[], role: Role | null): NavItem[] {
  return role ? items.filter((item) => item.roles.includes(role)) : [];
}
