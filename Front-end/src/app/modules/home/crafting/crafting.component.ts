import { Blacksmiths } from './../core/data/enums/blacksmiths.enum';
import { CraftingStaticData } from '../core/data/crafting.static.data';
import { Qualities } from '../core/models/qualities.enum';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
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
  blacksmitForm: FormGroup;
  items: any[];
  selectedCity1: any;

  public get form() {
    return this.blacksmitForm;
  }


  /**
   * Constructor
   */
  constructor(private primengConfig: PrimeNGConfig, private formBuilder: FormBuilder) {
      this.forges = CraftingStaticData.Forges;
      this.blacksmiths = CraftingStaticData.Blacksmiths;
      this.enchanters = CraftingStaticData.Enchanters;
      this.qualities = CraftingStaticData.Qualities;
      this.items = CraftingStaticData.Items;
      
      this.blacksmitForm = this.formBuilder.group({
          blacksmith: ['', Validators.required],
          enchanter: ['', Validators.required],
          forge: ['', Validators.required],
          itemType: ['', Validators.required],
          weaponQuality: ['', Validators.required],

      })
  }

  ngOnInit() {
      this.primengConfig.ripple = true;
      this.form.controls["blacksmith"].patchValue(this.blacksmiths.find(c => c.id === Blacksmiths.MorgranFireforge));
      this.form.controls["enchanter"].patchValue(this.enchanters.find(c => c.id === Enchanters.SamuelYellin));
  }
}
