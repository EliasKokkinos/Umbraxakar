import { CraftingComponent } from './crafting.component';
import { Route } from '@angular/router';
import { AuthUnlockSessionComponent } from 'app/modules/auth/unlock-session/unlock-session.component';

export const CraftingRoutes: Route[] = [
    {
        path     : '',
        component: CraftingComponent
    }
];
