import { LightArmor } from './enums/light-armor.enum';
import { Blacksmiths } from './enums/blacksmiths.enum';
import { Qualities } from '../models/qualities.enum';
import { CraftingData } from "../models/crafting-data";
import { Forges } from './enums/forges.enum';
import { Items } from './enums/items.enum';
import { ArmorTypes } from './enums/armor-types.enum';
import { MediumArmor } from './enums/medium-armor.enum';
import { Shields } from './enums/shields.enum';
import { HeavyArmor } from './enums/heavy-armor.enum';

export class CraftingStaticData {

    public static Forges: CraftingData[] =
        [
            new CraftingData({
                name: Forges.Hephaestus,
                code: Forges.Hephaestus,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 4,
                daysToCraft: 0,
                daysToCraftModifier: 0.5,
            }),
        ];

    public static Blacksmiths: CraftingData[] =
        [
            new CraftingData({
                name: Blacksmiths.MorgranFireforge,
                code: Blacksmiths.MorgranFireforge,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 1,
                daysToCraft: 0,
                daysToCraftModifier: 1,
            }),
        ];

    public static Qualities: CraftingData[] =
        [
            new CraftingData({
                name: Qualities.Magic_1,
                code: Qualities.Magic_1,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 1,
                daysToCraft: 0,
                daysToCraftModifier: 1,
            }),
            new CraftingData({
                name: Qualities.Magic_2,
                code: Qualities.Magic_2,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 2,
                daysToCraft: 0,
                daysToCraftModifier: 2,
            }),
            new CraftingData({
                name: Qualities.Magic_3,
                code: Qualities.Magic_3,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 3,
                daysToCraft: 0,
                daysToCraftModifier: 3,
            }),
        ];

    public static Items: CraftingData[] =
        [
            new CraftingData({
                name: Items.Armors,
                code: Items.Armors,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 1,
                daysToCraft: 0,
                daysToCraftModifier: 1,
                data: [
                    new CraftingData({
                        name: ArmorTypes.LightArmor,
                        code: ArmorTypes.LightArmor,
                        cost: 0,
                        costModifier: 1,
                        value: 0,
                        valueModifier: 1,
                        daysToCraft: 0,
                        daysToCraftModifier: 1,
                        data: [
                            new CraftingData({
                                name: LightArmor.Padded,
                                code: LightArmor.Padded,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: LightArmor.Leather,
                                code: LightArmor.Leather,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: LightArmor.StuddedLeather,
                                code: LightArmor.StuddedLeather,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                        ]
                    }),
                    new CraftingData({
                        name: ArmorTypes.MediumArmor,
                        code: ArmorTypes.MediumArmor,
                        cost: 0,
                        costModifier: 1,
                        value: 0,
                        valueModifier: 1,
                        daysToCraft: 0,
                        daysToCraftModifier: 1,
                        data: [
                            new CraftingData({
                                name: MediumArmor.Hide,
                                code: MediumArmor.Hide,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: MediumArmor.ChainShirt,
                                code: MediumArmor.ChainShirt,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: MediumArmor.ScaleMail,
                                code: MediumArmor.ScaleMail,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: MediumArmor.BreastPlate,
                                code: MediumArmor.BreastPlate,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: MediumArmor.HalfPlate,
                                code: MediumArmor.HalfPlate,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),

                        ]
                    }),
                    new CraftingData({
                        name: ArmorTypes.HeavyArmor,
                        code: ArmorTypes.HeavyArmor,
                        cost: 0,
                        costModifier: 1,
                        value: 0,
                        valueModifier: 1,
                        daysToCraft: 0,
                        daysToCraftModifier: 1,
                        data: [
                            new CraftingData({
                                name: HeavyArmor.RingMail,
                                code: HeavyArmor.RingMail,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: HeavyArmor.ChainMail,
                                code: HeavyArmor.ChainMail,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: HeavyArmor.Splint,
                                code: HeavyArmor.Splint,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                            new CraftingData({
                                name: HeavyArmor.Plate,
                                code: HeavyArmor.Plate,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),

                        ]
                    }),
                    new CraftingData({
                        name: ArmorTypes.Shield,
                        code: ArmorTypes.Shield,
                        cost: 0,
                        costModifier: 1,
                        value: 0,
                        valueModifier: 1,
                        daysToCraft: 0,
                        daysToCraftModifier: 1,
                        data: [
                            new CraftingData({
                                name: Shields.Shield,
                                code: Shields.Shield,
                                cost: 0,
                                costModifier: 1,
                                value: 0,
                                valueModifier: 1,
                                daysToCraft: 0,
                                daysToCraftModifier: 1,
                            }),
                        ]
                    }),
                ]
            }),
            new CraftingData({
                name: Items.Weapons,
                code: Items.Weapons,
                cost: 0,
                costModifier: 1,
                value: 0,
                valueModifier: 1,
                daysToCraft: 0,
                daysToCraftModifier: 1,
            }),
        ];

}
