import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { CreateUserInput, ROLE_LABELS, Role, UserProfile, toApiError } from '../../core/models';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';
import { ExportColumn } from '../../core/utils/csv';
import { formatDate } from '../../core/utils/format';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm.service';
import {
  DataTableComponent,
  RowActionEvent,
  TableAction,
  TableColumn,
} from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ExportMenuComponent } from '../../shared/components/export-menu/export-menu.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';
import { UserFormModal } from './user-form.modal';

/** ViewModel de la gestión de usuarios (ámbito de página). */
const UsersStore = signalStore(
  withState({ users: [] as UserProfile[], loading: true, error: null as string | null }),
  withMethods((store, api = inject(UsersService)) => ({
    /** Carga la lista de usuarios. */
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.list().pipe(
            tap((users) => patchState(store, { users, loading: false })),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: toApiError(error).message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    /** Crea un usuario. */
    async create(input: CreateUserInput): Promise<void> {
      const user = await firstValueFrom(api.create(input));
      patchState(store, { users: [...store.users(), user] });
    },
    /** Cambia el rol de un usuario. */
    async changeRole(id: string, role: Role): Promise<void> {
      const user = await firstValueFrom(api.updateRole(id, role));
      patchState(store, { users: store.users().map((item) => (item.id === id ? user : item)) });
    },
  })),
);

/**
 * Gestión de usuarios (solo Administrador): alta con validación asíncrona y cambio de rol.
 */
@Component({
  selector: 'app-users-page',
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    PageHeaderComponent,
    DataTableComponent,
    ExportMenuComponent,
    EmptyStateComponent,
  ],
  providers: [UsersStore],
  template: `
    <ion-content>
      <div class="sp-page sp-stack">
        <app-page-header
          title="Usuarios"
          subtitle="Da de alta cuentas y gestiona sus roles."
          [breadcrumbs]="[{ label: 'Inicio', link: '/' }, { label: 'Usuarios' }]"
          (helpRequested)="help.open('usuarios')"
        >
          <app-export-menu
            label="Exportar usuarios"
            [disabled]="store.loading() || !visibleRows().length"
            [busy]="exporting()"
            (exportCsv)="exportCsv()"
            (exportPdf)="exportPdf()"
          />
          <ion-button (click)="create()">
            <ion-icon slot="start" name="person-add-outline" aria-hidden="true"></ion-icon>
            Nuevo usuario
          </ion-button>
        </app-page-header>

        <section class="sp-card" aria-label="Listado de usuarios">
          @if (store.error()) {
            <app-empty-state
              tone="error"
              icon="cloud-offline-outline"
              title="No se han podido cargar los usuarios"
              [message]="store.error() ?? ''"
            >
              <ion-button (click)="store.load()">Reintentar</ion-button>
            </app-empty-state>
          } @else {
            <app-data-table
              caption="Listado de usuarios"
              searchPlaceholder="Buscar por nombre, correo o rol…"
              [rows]="store.users()"
              [columns]="columns"
              [rowKey]="rowKey"
              [actions]="actions"
              [loading]="store.loading()"
              [initialSort]="{ key: 'name', direction: 'asc' }"
              (rowAction)="onAction($event)"
              (viewChange)="visibleRows.set($event)"
            />
          }
        </section>
      </div>
    </ion-content>
  `,
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  protected readonly store = inject(UsersStore);
  protected readonly help = inject(HelpService);
  private readonly auth = inject(AuthStore);
  private readonly modals = inject(ModalController);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly reports = inject(ReportService);

  protected readonly visibleRows = signal<UserProfile[]>([]);
  protected readonly exporting = signal(false);
  protected readonly rowKey = (row: UserProfile): string => row.id;

  protected readonly columns: TableColumn<UserProfile>[] = [
    { key: 'name', header: 'Nombre', value: (row) => row.fullName, sortable: true, primary: true },
    { key: 'email', header: 'Correo', value: (row) => row.email, sortable: true },
    {
      key: 'role',
      header: 'Rol',
      value: (row) => ROLE_LABELS[row.role],
      type: 'badge',
      sortable: true,
      badge: (row) => ({
        label: ROLE_LABELS[row.role],
        variant: row.role === 'admin' ? 'primary' : 'neutral',
      }),
    },
    {
      key: 'created',
      header: 'Alta',
      value: (row) => row.createdAt,
      type: 'date',
      sortable: true,
      hideOnMobile: true,
    },
  ];

  protected readonly actions: TableAction<UserProfile>[] = [
    {
      id: 'role',
      label: 'Cambiar rol',
      icon: 'swap-horizontal-outline',
      color: 'primary',
      visible: (row) => row.id !== this.auth.profile()?.id,
    },
  ];

  private readonly exportColumns: ExportColumn<UserProfile>[] = [
    { header: 'Nombre', value: (row) => row.fullName },
    { header: 'Correo', value: (row) => row.email },
    { header: 'Rol', value: (row) => ROLE_LABELS[row.role] },
    { header: 'Alta', value: (row) => formatDate(row.createdAt) },
  ];

  constructor() {
    this.store.load();
  }

  /** Abre el formulario de alta. */
  protected async create(): Promise<void> {
    const modal = await this.modals.create({
      component: UserFormModal,
      componentProps: { onSave: (value: CreateUserInput) => this.store.create(value) },
      cssClass: 'sp-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'save') {
      void this.toast.success('Usuario creado.');
    }
  }

  /** Cambia el rol tras confirmación. */
  protected async onAction(event: RowActionEvent<UserProfile>): Promise<void> {
    if (event.action !== 'role') {
      return;
    }
    const next: Role = event.row.role === 'admin' ? 'user' : 'admin';
    const confirmed = await this.confirm.ask({
      title: 'Cambiar rol',
      message: `¿Cambiar el rol de ${event.row.fullName} a «${ROLE_LABELS[next]}»?`,
      confirmText: 'Cambiar rol',
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.changeRole(event.row.id, next);
      void this.toast.success(`${event.row.fullName} ahora es ${ROLE_LABELS[next]}.`);
    } catch (error) {
      void this.toast.error(toApiError(error).message);
    }
  }

  /** Exporta a CSV. */
  protected exportCsv(): void {
    const file = this.reports.exportCsv({
      entity: 'usuarios',
      columns: this.exportColumns,
      rows: this.visibleRows(),
    });
    void this.toast.success(`Descargado ${file}`);
  }

  /** Exporta a PDF. */
  protected async exportPdf(): Promise<void> {
    this.exporting.set(true);
    try {
      const file = await this.reports.exportPdf({
        title: 'Listado de usuarios',
        entity: 'usuarios',
        author: this.auth.profile()?.fullName,
        columns: this.exportColumns,
        rows: this.visibleRows(),
      });
      void this.toast.success(`Descargado ${file}`);
    } catch {
      void this.toast.error('No se ha podido generar el PDF.');
    } finally {
      this.exporting.set(false);
    }
  }
}
