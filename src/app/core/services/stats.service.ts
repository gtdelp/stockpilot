import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardData, Kpis, SeriesPoint, StatsFilter } from '../models';
import { toParams } from './http-params';

/**
 * Estadísticas consolidadas para el cuadro de mando (solo administradores).
 */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/stats`;

  /**
   * Carga en paralelo (`forkJoin`) todas las series del cuadro de mando.
   * Emite una sola vez cuando han terminado todas las peticiones.
   */
  dashboard(filter: StatsFilter): Observable<DashboardData> {
    const params = toParams({ ...filter });
    return forkJoin({
      kpis: this.http.get<Kpis>(`${this.baseUrl}/kpis`, { params }),
      salesByMonth: this.http.get<SeriesPoint[]>(`${this.baseUrl}/sales-by-month`, { params }),
      stockByCategory: this.http.get<SeriesPoint[]>(`${this.baseUrl}/stock-by-category`, {
        params,
      }),
      topProducts: this.http.get<SeriesPoint[]>(`${this.baseUrl}/top-products`, { params }),
      ordersByStatus: this.http.get<SeriesPoint[]>(`${this.baseUrl}/orders-by-status`, { params }),
    });
  }
}
