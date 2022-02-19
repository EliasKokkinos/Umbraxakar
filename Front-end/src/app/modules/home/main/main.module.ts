import { MainRoutes } from './main.routing';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainComponent } from './main.component';
import { RouterModule } from '@angular/router';
import { SharedModule } from 'app/shared/shared.module';

@NgModule({
  imports: [
    RouterModule.forChild(MainRoutes),
    CommonModule,
    SharedModule,
  ],
  declarations: [MainComponent]
})
export class MainModule { }
