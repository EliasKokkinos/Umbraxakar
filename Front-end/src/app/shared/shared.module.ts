import { GlassCardComponent } from './glass-card/glass-card.component';
import { GlassmorphContainerComponent } from './glassmorph-container/glassmorph-container.component';
import { GlassContainerComponent } from './glass-container/glass-container.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { DropdownModule } from 'primeng/dropdown';
import { CardComponent } from './card/card.component';

@NgModule({
    declarations: [
        CardComponent,
        GlassContainerComponent,
        GlassmorphContainerComponent,
        GlassCardComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule
    ],
    exports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        PanelModule,
        ButtonModule,
        RippleModule,
        DropdownModule,
        CardComponent,
        GlassContainerComponent,
        GlassCardComponent,
        GlassmorphContainerComponent,
    ]
})
export class SharedModule {
}
