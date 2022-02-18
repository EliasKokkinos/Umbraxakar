import { CascadeSelectModule } from 'primeng/cascadeselect';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CraftingComponent } from './crafting.component';
import { SharedModule } from 'app/shared/shared.module';
import { CraftingRoutes } from './crafting.routing';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forChild(CraftingRoutes),
    CommonModule,
    SharedModule,
    CascadeSelectModule,
  ],
  declarations: [CraftingComponent]
})
export class CraftingModule { }
