import { DropdownOptions } from 'app/core/models/dropdown-options.base';
export class CraftingData extends DropdownOptions {
    cost: number;
    costModifier: number;
    daysToCraft: number;
    daysToCraftModifier: number;


    constructor(data?: DropdownOptions) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
}
