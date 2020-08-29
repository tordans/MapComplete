import {Layout} from "../Layout";
import {LayoutConfigJson} from "./LayoutConfigJson";
import {AndOrTagConfigJson} from "./TagConfigJson";
import {And, RegexTag, Tag, TagsFilter} from "../../Logic/Tags";
import {TagRenderingConfigJson} from "./TagRenderingConfigJson";
import {TagRenderingOptions} from "../TagRenderingOptions";
import Translation from "../../UI/i18n/Translation";
import {LayerConfigJson} from "./LayerConfigJson";
import {LayerDefinition, Preset} from "../LayerDefinition";
import {TagDependantUIElementConstructor} from "../UIElementConstructor";
import FixedText from "../Questions/FixedText";
import Translations from "../../UI/i18n/Translations";
import Combine from "../../UI/Base/Combine";
import {ImageCarouselWithUploadConstructor} from "../../UI/Image/ImageCarouselWithUpload";
import {ImageCarouselConstructor} from "../../UI/Image/ImageCarousel";


export class FromJSON {


    public static FromBase64(layoutFromBase64: string): Layout {
        return FromJSON.LayoutFromJSON(JSON.parse(atob(layoutFromBase64)));
    }

    public static LayoutFromJSON(json: LayoutConfigJson): Layout {
        console.log("Parsing ", json.id)
        const tr = FromJSON.Translation;

        const layers = json.layers.map(FromJSON.Layer);
        const roaming: TagDependantUIElementConstructor[] = json.roamingRenderings?.map(FromJSON.TagRendering) ?? [];
        for (const layer of layers) {
            layer.elementsToShow.push(...roaming);
        }

        const layout = new Layout(
            json.id,
            typeof (json.language) === "string" ? [json.language] : json.language,
            tr(json.title),
            layers,
            json.startZoom,
            json.startLat,
            json.startLon,
            new Combine(["<h3>", tr(json.title), "</h3>", tr(json.description)]),
        );

        layout.widenFactor = json.widenFactor ?? 0.07;
        layout.icon = json.icon;
        layout.maintainer = json.maintainer;
        layout.version = json.version;
        layout.socialImage = json.socialImage;
        layout.changesetMessage = json.changesetmessage;
        return layout;
    }

    public static Translation(json: string | any): string | Translation {
        if (json === undefined) {
            return undefined;
        }
        if (typeof (json) === "string") {
            return json;
        }
        const tr = {};
        for (let key in json) {
            tr[key] = json[key]; // I'm doing this wrong, I know
        }
        return new Translation(tr);
    }

    public static TagRendering(json: TagRenderingConfigJson | string): TagDependantUIElementConstructor {
        return FromJSON.TagRenderingWithDefault(json, "", undefined);
    }

    public static TagRenderingWithDefault(json: TagRenderingConfigJson | string, propertyName, defaultValue: string): TagDependantUIElementConstructor {
            if (json === undefined) {
            if(defaultValue !== undefined){
                console.warn(`Using default value ${defaultValue} for  ${propertyName}`)
                return FromJSON.TagRendering(defaultValue);
            }
            throw `Tagrendering ${propertyName} is undefined...`
        }

        if (typeof json === "string") {

            switch (json) {
                case "picture": {
                    return new ImageCarouselWithUploadConstructor()
                }
                case "pictures": {
                    return new ImageCarouselWithUploadConstructor()
                }
                case "image": {
                    return new ImageCarouselWithUploadConstructor()
                }
                case "images": {
                    return new ImageCarouselWithUploadConstructor()
                }
                case "picturesNoUpload": {
                    return new ImageCarouselConstructor()
                }
            }


            return new TagRenderingOptions({
                freeform: {
                    key: "id",
                    renderTemplate: json,
                    template: "$$$"
                }
            });
        }

        let template = FromJSON.Translation(json.render);

        let freeform = undefined;
        if (json.freeform) {

            if(json.render === undefined){
                console.error("Freeform is defined, but render is not. This is not allowed.", json)
                throw "Freeform is defined, but render is not. This is not allowed."
            }
            
            freeform = {
                template: `$${json.freeform.type ?? "string"}$`,
                renderTemplate: template,
                key: json.freeform.key
            };
            if (json.freeform.addExtraTags) {
                freeform["extraTags"] = FromJSON.Tag(json.freeform.addExtraTags);
            }
        } else if (json.render) {
            freeform = {
                template: `$string$`,
                renderTemplate: template,
                key: "id"
            }
        }

        const mappings = json.mappings?.map(mapping => (
            {
                k: FromJSON.Tag(mapping.if),
                txt: FromJSON.Translation(mapping.then),
                hideInAnswer: mapping.hideInAnswer  
            })
        );

        return new TagRenderingOptions({
            question: FromJSON.Translation(json.question),
            freeform: freeform,
            mappings: mappings
        });
    }

    public static SimpleTag(json: string): Tag {
        const tag = json.split("=");
        return new Tag(tag[0], tag[1]);
    }

    public static Tag(json: AndOrTagConfigJson | string): TagsFilter {
        if (typeof (json) == "string") {
            const tag = json as string;
            if (tag.indexOf("!~") >= 0) {
                const split = tag.split("!~");
                if(split[1] == "*"){
                    split[1] = ".*"
                }
                return new RegexTag(
                    new RegExp(split[0]),
                    new RegExp(split[1]),
                    true
                );
            }
            if (tag.indexOf("!=") >= 0) {
                const split = tag.split("!=");
                return new RegexTag(
                    new RegExp(split[0]),
                    new RegExp(split[1]),
                    true
                );
            }
            if (tag.indexOf("~") >= 0) {
                const split = tag.split("~");
                if(split[1] == "*"){
                    split[1] = ".*"
                }
                return new RegexTag(
                    new RegExp("^"+split[0]+"$"),
                    new RegExp("^"+split[1]+"$")
                );
            }
            const split = tag.split("=");
            return new Tag(split[0], split[1])
        }
        if (json.and !== undefined) {
            return new And(json.and.map(FromJSON.Tag));
        }
        if (json.or !== undefined) {
            return new And(json.or.map(FromJSON.Tag));
        }
    }

    private static Title(json: string | Map<string, string> | TagRenderingConfigJson): TagDependantUIElementConstructor {
        if ((json as TagRenderingConfigJson).render !== undefined) {
            return FromJSON.TagRendering((json as TagRenderingConfigJson));
        } else if (typeof (json) === "string") {
            return new FixedText(Translations.WT(json));
        } else {
            return new FixedText(FromJSON.Translation(json as Map<string, string>));
        }
    }

    public static Layer(json: LayerConfigJson): LayerDefinition {
        console.log("Parsing ",json.name);
        const tr = FromJSON.Translation;
        const overpassTags = FromJSON.Tag(json.overpassTags);
        const icon = FromJSON.TagRenderingWithDefault(json.icon, "layericon", "./assets/bug.svg");
        const color = FromJSON.TagRenderingWithDefault(json.color, "layercolor", "#0000ff");
        const width = FromJSON.TagRenderingWithDefault(json.width, "layerwidth", "10");
        const renderTags = {"id": "node/-1"}
        const presets: Preset[] = json?.presets?.map(preset => {
            return ({
                title: tr(preset.title),
                description: tr(preset.description),
                tags: preset.tags.map(FromJSON.SimpleTag)
            });
        }) ?? [];

        function style(tags) {
            return {
                color: color.GetContent(tags).txt,
                weight: width.GetContent(tags).txt,
                icon: {
                    iconUrl: icon.GetContent(tags).txt
                },
            }
        }

        const layer = new LayerDefinition(
            json.id,
            {
                name: tr(json.name),
                description: tr(json.description),
                icon: icon.GetContent(renderTags).txt,
                overpassFilter: overpassTags,

                title: FromJSON.Title(json.title),
                minzoom: json.minzoom,
                presets: presets,
                elementsToShow: json.tagRenderings?.map(FromJSON.TagRendering) ?? [],
                style: style,
                wayHandling: json.wayHandling

            }
        );
        return layer;

    }


}