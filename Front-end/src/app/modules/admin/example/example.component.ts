import { Qualities } from '../models/qualities.enum';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Component, ViewEncapsulation } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';

interface DropdownOptions {
    name: string,
    code: number
}



@Component({
    selector: 'example',
    templateUrl: './example.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ExampleComponent {
    qualities: DropdownOptions[];
    forges: DropdownOptions[];
    blacksmiths: DropdownOptions[];
    blacksmitForm: FormGroup;
    items: any[];
    selectedCity1: any;


    /**
     * Constructor
     */
    constructor(private primengConfig: PrimeNGConfig, private formBuilder: FormBuilder) {
        this.forges = [
            { name: 'Hephaestus', code: Qualities.Magic_1 },
        ];
        this.blacksmiths = [
            { name: 'Morgran Fireforge', code: Qualities.Magic_1 },
        ];
        this.qualities = [
            { name: 'Magic +1', code: Qualities.Magic_1 },
            { name: 'Magic +2', code: Qualities.Magic_2 },
            { name: 'Magic +3', code: Qualities.Magic_3 },
        ];
        this.items = [
            {
                name: 'Armor',
                code: 'Armor',
                states: [
                    {
                        name: 'Light Armor',
                        cities: [
                            { cname: 'Padded', code: 'Padded' },
                            { cname: 'Leather', code: 'Leather' },
                            { cname: 'Studded Leather', code: 'StuddedLeather' }
                        ]
                    },
                    {
                        name: 'Medium Armor',
                        cities: [
                            { cname: 'Hide', code: 'Hide' },
                            { cname: 'Chain Shirt', code: 'ChainShirt' },
                            { cname: 'Scale Mail', code: 'ScaleMail' },
                            { cname: 'Breast Plate', code: 'BreastPlate' },
                            { cname: 'Half Plate', code: 'HalfPlate' }
                        ]
                    },
                    {
                        name: 'Heavy Armor',
                        cities: [
                            { cname: 'Ring Mail', code: 'RingMail' },
                            { cname: 'Chain Mail', code: 'ChainMail' },
                            { cname: 'Splint', code: 'Splint' },
                            { cname: 'Plate', code: 'Plate' },
                        ]
                    },
                    {
                        name: 'Shield',
                        cities: [
                            { cname: 'Shield', code: 'Shield' },
                        ]
                    },
                ]
            },
            {
                name: 'Weapon',
                code: 'Weapon',
                states: [
                    {
                        name: 'Simple Meele Weapons',
                        cities: [
                            { cname: 'Club', code: 'Club' },
                            { cname: 'Dagger', code: 'Dagger' },
                            { cname: 'Greatclub', code: 'Greatclub' },
                            { cname: 'Handaxe', code: 'Handaxe' },
                            { cname: 'Javelin', code: 'Javelin' },
                            { cname: 'Light Hammer', code: 'LightHammer' },
                            { cname: 'Mace', code: 'Mace' },
                            { cname: 'Quarterstaff', code: 'Quarterstaff' },
                            { cname: 'Sickle', code: 'Sickle' },
                            { cname: 'Spear', code: 'Spear' },
                        ]
                    },
                    {
                        name: 'Simple Ranged Weapons',
                        cities: [
                            { cname: 'Crossbow, light', code: 'LightCrossbow' },
                            { cname: 'Dart', code: 'Dart' },
                            { cname: 'Shortbow', code: 'Shortbow' },
                            { cname: 'Sling', code: 'Sling' },
                        ]
                    },
                    {
                        name: 'Martial Meele Weapons',
                        cities: [
                            { cname: 'Battleaxe', code: 'Battleaxe' },
                            { cname: 'Flail', code: 'Flail' },
                            { cname: 'Glaive', code: 'Glaive' },
                            { cname: 'Greataxe', code: 'Greataxe' },
                            { cname: 'Greatsword', code: 'Greatsword' },
                            { cname: 'Halberd', code: 'Halberd' },
                            { cname: 'Lance', code: 'Lance' },
                            { cname: 'Longsword', code: 'Longsword' },
                            { cname: 'Maul', code: 'Maul' },
                            { cname: 'Morningstar', code: 'Morningstar' },
                            { cname: 'Pike', code: 'Pike' },
                            { cname: 'Rapier', code: 'Rapier' },
                            { cname: 'Scimitar', code: 'Scimitar' },
                            { cname: 'Shortsword', code: 'Shortsword' },
                            { cname: 'Trident', code: 'Trident' },
                            { cname: 'Warpick', code: 'Warpick' },
                            { cname: 'Warhammer', code: 'Warhammer' },
                            { cname: 'Whip', code: 'Whip' },
                        ]
                    },
                    {
                        name: 'Martial Ranged Weapons',
                        cities: [
                            { cname: 'Blowgun', code: 'Blowgun' },
                            { cname: 'Crossbow, hand', code: 'HandCrossbow' },
                            { cname: 'Crossbow, heavy', code: 'HeavyCrossbow' },
                            { cname: 'Longbow', code: 'Longbow' },
                            { cname: 'Net', code: 'Net' },
                        ]
                    },

                ]
            },
        ];
        this.blacksmitForm = this.formBuilder.group({
            blacksmith: ['', Validators.required],
            forge: ['', Validators.required],
            itemType: ['', Validators.required],
            weaponQuality: ['', Validators.required],

        })
    }

    ngOnInit() {
        this.primengConfig.ripple = true;
    }
}
