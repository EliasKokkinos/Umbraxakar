import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dm' },
  { path: 'dm', title: 'Chaos Engine: DM', loadComponent: () => import('./dm/dm-gate').then((m) => m.DmGate) },
  { path: 'table', title: 'Chaos Engine', loadComponent: () => import('./table/table-screen').then((m) => m.TableScreen) },
  { path: '**', redirectTo: 'dm' },
];
