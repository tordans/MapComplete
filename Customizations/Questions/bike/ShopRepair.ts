import {Tag} from "../../../Logic/Tags";
import Translations from "../../../UI/i18n/Translations";
import {TagRenderingOptions} from "../../TagRenderingOptions";


export default class ShopRepair extends TagRenderingOptions {
    constructor() {
        const key = 'service:bicycle:repair'
        const to = Translations.t.cyclofix.shop.repair
        super({
            question: to.question,
            mappings: [
                {k: new Tag(key, "yes"), txt: to.yes},
                {k: new Tag(key, "only_sold"), txt: to.sold},
                {k: new Tag(key, "brand"), txt: to.brand},
                {k: new Tag(key, "no"), txt: to.no},
            ]
        });
    }
}
