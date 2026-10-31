import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guards';

/**
 * Rutas de la aplicación. Todas las vistas se cargan de forma diferida
 * (`loadComponent`) y se protegen con guards `canMatch` por sesión y rol.
 */
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    title: 'Iniciar sesión · StockPilot',
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    canMatch: [guestGuard],
    title: 'Crear cuenta · StockPilot',
    loadComponent: () =>
      import('./features/auth/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => inject(AuthStore).homeUrl().slice(1),
      },
      {
        path: 'panel',
        canMatch: [roleGuard],
        data: { roles: ['admin'] },
        title: 'Cuadro de mando · StockPilot',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'productos',
        title: 'Productos · StockPilot',
        loadComponent: () =>
          import('./features/products/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'pedidos',
        title: 'Pedidos · StockPilot',
        loadComponent: () => import('./features/orders/orders.page').then((m) => m.OrdersPage),
      },
      {
        path: 'pedidos/nuevo',
        title: 'Nuevo pedido · StockPilot',
        loadComponent: () => import('./features/orders/new-order.page').then((m) => m.NewOrderPage),
      },
      {
        path: 'usuarios',
        canMatch: [roleGuard],
        data: { roles: ['admin'] },
        title: 'Usuarios · StockPilot',
        loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'maestros',
        canMatch: [roleGuard],
        data: { roles: ['admin'] },
        title: 'Categorías y proveedores · StockPilot',
        loadComponent: () => import('./features/masters/masters.page').then((m) => m.MastersPage),
      },
      {
        path: 'perfil',
        title: 'Mi perfil · StockPilot',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'ayuda',
        title: 'Ayuda · StockPilot',
        loadComponent: () => import('./features/help/help.page').then((m) => m.HelpPage),
      },
      {
        path: '403',
        title: 'Acceso denegado · StockPilot',
        loadComponent: () =>
          import('./features/errors/forbidden.page').then((m) => m.ForbiddenPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Página no encontrada · StockPilot',
    loadComponent: () => import('./features/errors/not-found.page').then((m) => m.NotFoundPage),
  },
];
