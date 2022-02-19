import { Forges } from './../core/data/enums/forges.enum';
import { Blacksmiths } from './../core/data/enums/blacksmiths.enum';
import { CraftingStaticData } from '../core/data/crafting.static.data';
import { Qualities } from '../core/models/qualities.enum';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { DropdownOptions } from 'app/core/models/dropdown-options.base';
import { CraftingData } from '../core/models/crafting-data';
import { Enchanters } from '../core/data/enums/enchanter.enum';

@Component({
  selector: 'app-crafting',
  templateUrl: './crafting.component.html',
  styleUrls: ['./crafting.component.scss']
})
export class CraftingComponent implements OnInit {
  qualities: CraftingData[];
  forges: CraftingData[];
  blacksmiths: CraftingData[];
  enchanters: CraftingData[];
  enchantments: CraftingData[];
  attributes: CraftingData[];
  forgingTechniques: CraftingData[];
  blacksmithForm: FormGroup;
  items: any[];
  selectedCity1: any;

  public get form() {
    return this.blacksmithForm;
  }

  public get enchantmentsArray() { return  this.blacksmithForm.controls['enchantments'] as FormArray; }

  /**
   * Constructor
   */
  constructor(private primengConfig: PrimeNGConfig, private formBuilder: FormBuilder) {
      this.forges = CraftingStaticData.Forges;
      this.blacksmiths = CraftingStaticData.Blacksmiths;
      this.enchanters = CraftingStaticData.Enchanters;
      this.qualities = CraftingStaticData.Qualities;
      this.items = CraftingStaticData.Items;
      this.attributes = CraftingStaticData.Attributes;
      this.forgingTechniques = CraftingStaticData.ForgingTechniques;
      
      this.blacksmithForm = this.formBuilder.group({
          blacksmith: ['', Validators.required],
          enchanter: ['', Validators.required],
          forge: ['', Validators.required],
          itemType: ['', Validators.required],
          weaponQuality: ['', Validators.required],
          enchantments: new FormArray([]),
          forgingTechnique: ['', Validators.required],

      })
      
      this.form.controls["forge"].valueChanges.subscribe((result: CraftingData) => {
        console.log(result);
        this.enchantments = result.warrens;

        //TODO The number of allowed Enchantments is based on the weapon, its material and maybe Quality?
        this.enchantmentsArray.push(this.formBuilder.group({
          enchantment: ['', Validators.required],
          attribute: ['', Validators.required]
        }));
        this.enchantmentsArray.push(this.formBuilder.group({
          enchantment: ['', Validators.required],
          attribute: ['', Validators.required]
        }));
        
      });
      
      //TODO Depends on the weapons
      this.forgingTechniques = CraftingStaticData.ForgingTechniques;
  }

  ngOnInit() {
      this.primengConfig.ripple = true;
      this.form.controls["blacksmith"].patchValue(this.blacksmiths.find(c => c.id === Blacksmiths.MorgranFireforge));
      this.form.controls["enchanter"].patchValue(this.enchanters.find(c => c.id === Enchanters.SamuelYellin));
      this.form.controls["forge"].patchValue(this.forges.find(c => c.id === Forges.Hephaestus));
  }
}
