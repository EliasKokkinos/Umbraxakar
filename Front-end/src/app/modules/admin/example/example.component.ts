import { Component, ViewEncapsulation } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';

@Component({
    selector     : 'example',
    templateUrl  : './example.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ExampleComponent
{
    /**
     * Constructor
     */
     constructor(private primengConfig: PrimeNGConfig) {}

     ngOnInit() {
        this.primengConfig.ripple = true;
    }
}
