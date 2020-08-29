import {Tag} from "../../../Logic/Tags";
import Translations from "../../../UI/i18n/Translations";
import {TagRenderingOptions} from "../../TagRenderingOptions";


export default class ShopPump extends TagRenderingOptions {
    constructor() {
        const key = 'service:bicycle:second_hand'
        const to = Translations.t.cyclofix.shop.secondHand
        super({
            question: to.question,
            mappings: [
                {k: new Tag(key, "yes"), txt: to.yes},
                {k: new Tag(key, "no"), txt: to.no},
                {k: new Tag(key, "only"), txt: to.only},
            ]
        });
    }
}
