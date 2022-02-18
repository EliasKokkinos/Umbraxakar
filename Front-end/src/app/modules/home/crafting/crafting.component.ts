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
      this.qualities = CraftingStaticData.Qualities;
      this.items = CraftingStaticData.Items;
      
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
