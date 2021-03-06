import { DropdownOptions } from 'app/core/models/dropdown-options.base';
export class CraftingData extends DropdownOptions {
    cost: number;
    costModifier: number;
    value: number;
    valueModifier: number;
    daysToCraft: number;
    daysToCraftModifier: number;
    units: number;
    data?: CraftingData[]
    warrens?: CraftingData[]

    constructor(data?: CraftingData) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
}
