import { CraftingStaticData } from '../data/crafting.static.data';
import { Qualities } from '../models/qualities.enum';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { DropdownOptions } from 'app/core/models/dropdown-options.base';

@Component({
  selector: 'app-crafting',
  templateUrl: './crafting.component.html',
  styleUrls: ['./crafting.component.scss']
})
export class CraftingComponent implements OnInit {
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
      this.forges = CraftingStaticData.Forges;
      this.blacksmiths = CraftingStaticData.Blacksmiths;
      this.qualities = CraftingStaticData.Qualities
      this.items = [
          {
              name: 'Armor',
              code: 'Armor',
              states: [
                  {
                      name: 'Light Armor',
                      cities: [
                          { name: 'Padded', code: 'Padded' },
                          { name: 'Leather', code: 'Leather' },
                          { name: 'Studded Leather', code: 'StuddedLeather' }
                      ]
                  },
                  {
                      name: 'Medium Armor',
                      cities: [
                          { name: 'Hide', code: 'Hide' },
                          { name: 'Chain Shirt', code: 'ChainShirt' },
                          { name: 'Scale Mail', code: 'ScaleMail' },
                          { name: 'Breast Plate', code: 'BreastPlate' },
                          { name: 'Half Plate', code: 'HalfPlate' }
                      ]
                  },
                  {
                      name: 'Heavy Armor',
                      cities: [
                          { name: 'Ring Mail', code: 'RingMail' },
                          { name: 'Chain Mail', code: 'ChainMail' },
                          { name: 'Splint', code: 'Splint' },
                          { name: 'Plate', code: 'Plate' },
                      ]
                  },
                  {
                      name: 'Shield',
                      cities: [
                          { name: 'Shield', code: 'Shield' },
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
                          { name: 'Club', code: 'Club' },
                          { name: 'Dagger', code: 'Dagger' },
                          { name: 'Greatclub', code: 'Greatclub' },
                          { name: 'Handaxe', code: 'Handaxe' },
                          { name: 'Javelin', code: 'Javelin' },
                          { name: 'Light Hammer', code: 'LightHammer' },
                          { name: 'Mace', code: 'Mace' },
                          { name: 'Quarterstaff', code: 'Quarterstaff' },
                          { name: 'Sickle', code: 'Sickle' },
                          { name: 'Spear', code: 'Spear' },
                      ]
                  },
                  {
                      name: 'Simple Ranged Weapons',
                      cities: [
                          { name: 'Crossbow, light', code: 'LightCrossbow' },
                          { name: 'Dart', code: 'Dart' },
                          { name: 'Shortbow', code: 'Shortbow' },
                          { name: 'Sling', code: 'Sling' },
                      ]
                  },
                  {
                      name: 'Martial Meele Weapons',
                      cities: [
                          { name: 'Battleaxe', code: 'Battleaxe' },
                          { name: 'Flail', code: 'Flail' },
                          { name: 'Glaive', code: 'Glaive' },
                          { name: 'Greataxe', code: 'Greataxe' },
                          { name: 'Greatsword', code: 'Greatsword' },
                          { name: 'Halberd', code: 'Halberd' },
                          { name: 'Lance', code: 'Lance' },
                          { name: 'Longsword', code: 'Longsword' },
                          { name: 'Maul', code: 'Maul' },
                          { name: 'Morningstar', code: 'Morningstar' },
                          { name: 'Pike', code: 'Pike' },
                          { name: 'Rapier', code: 'Rapier' },
                          { name: 'Scimitar', code: 'Scimitar' },
                          { name: 'Shortsword', code: 'Shortsword' },
                          { name: 'Trident', code: 'Trident' },
                          { name: 'Warpick', code: 'Warpick' },
                          { name: 'Warhammer', code: 'Warhammer' },
                          { name: 'Whip', code: 'Whip' },
                      ]
                  },
                  {
                      name: 'Martial Ranged Weapons',
                      cities: [
                          { name: 'Blowgun', code: 'Blowgun' },
                          { name: 'Crossbow, hand', code: 'HandCrossbow' },
                          { name: 'Crossbow, heavy', code: 'HeavyCrossbow' },
                          { name: 'Longbow', code: 'Longbow' },
                          { name: 'Net', code: 'Net' },
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
