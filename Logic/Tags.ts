import {Utils} from "../Utils";
import {type} from "os";

export abstract class TagsFilter {
    abstract matches(tags: { k: string, v: string }[]): boolean

    abstract asOverpass(): string[]

    abstract substituteValues(tags: any): TagsFilter;

    abstract isUsableAsAnswer(): boolean;

    abstract isEquivalent(other: TagsFilter): boolean;

    matchesProperties(properties: Map<string, string>): boolean {
        return this.matches(TagUtils.proprtiesToKV(properties));
    }

    abstract asHumanString(linkToWiki: boolean, shorten: boolean);

    abstract usedKeys(): string[];
}


export class RegexTag extends TagsFilter {
    private readonly key: RegExp | string;
    private readonly value: RegExp | string;
    private readonly invert: boolean;

    constructor(key: string | RegExp, value: RegExp | string, invert: boolean = false) {
        super();
        this.key = key;
        this.value = value;
        this.invert = invert;
    }

    private static doesMatch(fromTag: string, possibleRegex: string | RegExp): boolean {
        if (typeof possibleRegex === "string") {
            return fromTag === possibleRegex;
        }
        return fromTag.match(possibleRegex) !== null;
    }

    private static source(r: string | RegExp) {
        if (typeof (r) === "string") {
            return r;
        }
        return r.source;
    }

    asOverpass(): string[] {
        if (typeof this.key === "string") {
            return [`['${this.key}'${this.invert ? "!" : ""}~'${RegexTag.source(this.value)}']`];
        }
        return [`[~'${this.key.source}'${this.invert ? "!" : ""}~'${RegexTag.source(this.value)}']`];
    }

    isUsableAsAnswer(): boolean {
        return false;
    }

    matches(tags: { k: string; v: string }[]): boolean {
        for (const tag of tags) {
            if (RegexTag.doesMatch(tag.k, this.key)) {
                return RegexTag.doesMatch(tag.v, this.value) != this.invert;
            }
        }
        // The matching key was not found
        return this.invert;
    }

    substituteValues(tags: any): TagsFilter {
        return this;
    }

    asHumanString() {
        if (typeof this.key === "string") {
            return `${this.key}${this.invert ? "!" : ""}~${RegexTag.source(this.value)}`;
        }
        return `${this.key.source}${this.invert ? "!" : ""}~~${RegexTag.source(this.value)}`
    }

    isEquivalent(other: TagsFilter): boolean {
        if (other instanceof RegexTag) {
            return other.asHumanString() == this.asHumanString();
        }
        if (other instanceof Tag) {
            return RegexTag.doesMatch(other.key, this.key) && RegexTag.doesMatch(other.value, this.value);
        }
        return false;
    }

    usedKeys(): string[] {
        if (typeof this.key === "string") {
            return [this.key];
        }
        throw "Key cannot be determined as it is a regex"
    }
}


export class Tag extends TagsFilter {
    public key: string
    public value: string

    constructor(key: string, value: string) {
        super()
        this.key = key
        this.value = value
        if (key === undefined || key === "") {
            throw "Invalid key: undefined or empty";
        }
        if (value === undefined) {
            throw "Invalid value: value is undefined";
        }
        if (value === "*") {
            console.warn(`Got suspicious tag ${key}=*   ; did you mean ${key}~* ?`)
        }
    }

    matches(tags: { k: string; v: string }[]): boolean {

        for (const tag of tags) {
            if (this.key == tag.k) {
                return this.value === tag.v;
            }
        }

        // The tag was not found
        if (this.value === "") {
            // and it shouldn't be found!
            return true;
        }

        return false;
    }

    asOverpass(): string[] {
        if (this.value === "") {
            // NOT having this key
            return ['[!"' + this.key + '"]'];
        }
        return [`["${this.key}"="${this.value}"]`];
    }

    substituteValues(tags: any) {
        return new Tag(this.key, TagUtils.ApplyTemplate(this.value as string, tags));
    }

    asHumanString(linkToWiki: boolean, shorten: boolean) {
        let v = this.value;
        if (shorten) {
            v = Utils.EllipsesAfter(v, 25);
        }
        if (linkToWiki) {
            return `<a href='https://wiki.openstreetmap.org/wiki/Key:${this.key}' target='_blank'>${this.key}</a>` +
                `=` +
                `<a href='https://wiki.openstreetmap.org/wiki/Tag:${this.key}%3D${this.value}' target='_blank'>${v}</a>`
        }
        return this.key + "=" + v;
    }

    isUsableAsAnswer(): boolean {
        return true;
    }

    isEquivalent(other: TagsFilter): boolean {
        if (other instanceof Tag) {
            return this.key === other.key && this.value === other.value;
        }
        if (other instanceof RegexTag) {
            other.isEquivalent(this);
        }
        return false;
    }

    usedKeys(): string[] {
        return [this.key];
    }
}


export class Or extends TagsFilter {
    public or: TagsFilter[]

    constructor(or: TagsFilter[]) {
        super();
        this.or = or;
    }

    matches(tags: { k: string; v: string }[]): boolean {
        for (const tagsFilter of this.or) {
            if (tagsFilter.matches(tags)) {
                return true;
            }
        }

        return false;
    }

    asOverpass(): string[] {
        const choices = [];
        for (const tagsFilter of this.or) {
            const subChoices = tagsFilter.asOverpass();
            for (const subChoice of subChoices) {
                choices.push(subChoice)
            }
        }
        return choices;
    }

    substituteValues(tags: any): TagsFilter {
        const newChoices = [];
        for (const c of this.or) {
            newChoices.push(c.substituteValues(tags));
        }
        return new Or(newChoices);
    }

    asHumanString(linkToWiki: boolean, shorten: boolean) {
        return this.or.map(t => t.asHumanString(linkToWiki, shorten)).join("|");
    }

    isUsableAsAnswer(): boolean {
        return false;
    }

    isEquivalent(other: TagsFilter): boolean {
        if (other instanceof Or) {

            for (const selfTag of this.or) {
                let matchFound = false;
                for (let i = 0; i < other.or.length && !matchFound; i++) {
                    let otherTag = other.or[i];
                    matchFound = selfTag.isEquivalent(otherTag);
                }
                if (!matchFound) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    usedKeys(): string[] {
        return [].concat(this.or.map(subkeys => subkeys.usedKeys()));
    }
}


export class And extends TagsFilter {
    public and: TagsFilter[]

    constructor(and: TagsFilter[]) {
        super();
        this.and = and;
    }

    private static combine(filter: string, choices: string[]): string[] {
        const values = [];
        for (const or of choices) {
            values.push(filter + or);
        }
        return values;
    }

    matches(tags: { k: string; v: string }[]): boolean {
        for (const tagsFilter of this.and) {
            if (!tagsFilter.matches(tags)) {
                return false;
            }
        }

        return true;
    }

    asOverpass(): string[] {
        let allChoices: string[] = null;
        for (const andElement of this.and) {
            const andElementFilter = andElement.asOverpass();
            if (allChoices === null) {
                allChoices = andElementFilter;
                continue;
            }

            const newChoices: string[] = [];
            for (const choice of allChoices) {
                newChoices.push(
                    ...And.combine(choice, andElementFilter)
                )
            }
            allChoices = newChoices;
        }
        return allChoices;
    }

    substituteValues(tags: any): TagsFilter {
        const newChoices = [];
        for (const c of this.and) {
            newChoices.push(c.substituteValues(tags));
        }
        return new And(newChoices);
    }

    asHumanString(linkToWiki: boolean, shorten: boolean) {
        return this.and.map(t => t.asHumanString(linkToWiki, shorten)).join("&");
    }

    isUsableAsAnswer(): boolean {
        for (const t of this.and) {
            if (!t.isUsableAsAnswer()) {
                return false;
            }
        }
        return true;
    }

    isEquivalent(other: TagsFilter): boolean {
        if (!(other instanceof And)) {
            return false;
        }

        for (const selfTag of this.and) {
            let matchFound = false;
            for (let i = 0; i < other.and.length && !matchFound; i++) {
                let otherTag = other.and[i];
                matchFound = selfTag.isEquivalent(otherTag);
            }
            if (!matchFound) {
                return false;
            }
        }

        for (const selfTag of this.and) {
            let matchFound = false;
            for (const otherTag of other.and) {
                matchFound = selfTag.isEquivalent(otherTag);
                if (matchFound) {
                    break;
                }
            }
            if (!matchFound) {
                return false;
            }
        }

        for (const otherTag of other.and) {
            let matchFound = false;
            for (const selfTag of this.and) {
                matchFound = selfTag.isEquivalent(otherTag);
                if (matchFound) {
                    break;
                }
            }
            if (!matchFound) {
                return false;
            }
        }


        return true;
    }

    usedKeys(): string[] {
        return [].concat(this.and.map(subkeys => subkeys.usedKeys()));
    }
}


export class TagUtils {
    static proprtiesToKV(properties: any): { k: string, v: string }[] {
        const result = [];
        for (const k in properties) {
            result.push({k: k, v: properties[k]})
        }
        return result;
    }

    static ApplyTemplate(template: string, tags: any): string {
        for (const k in tags) {
            while (template.indexOf("{" + k + "}") >= 0) {
                const escaped = tags[k].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                template = template.replace("{" + k + "}", escaped);
            }
        }
        return template;
    }

    static KVtoProperties(tags: Tag[]): any {
        const properties = {};
        for (const tag of tags) {
            properties[tag.key] = tag.value
        }
        return properties;
    }

    /**
     * Given two hashes of {key --> values[]}, makes sure that every neededTag is present in availableTags
     */
    static AllKeysAreContained(availableTags: any, neededTags: any) {
        for (const neededKey in neededTags) {
            const availableValues: string[] = availableTags[neededKey]
            if (availableValues === undefined) {
                return false;
            }
            const neededValues: string[] = neededTags[neededKey];
            for (const neededValue of neededValues) {
                if (availableValues.indexOf(neededValue) < 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /***
     * Creates a hash {key --> [values]}, with all the values present in the tagsfilter
     *
     * @param tagsFilters
     * @constructor
     */
    static SplitKeys(tagsFilters: TagsFilter[]) {
        const keyValues = {} // Map string -> string[]
        tagsFilters = [...tagsFilters] // copy all
        while (tagsFilters.length > 0) {
            // Queue
            const tagsFilter = tagsFilters.shift();

            if (tagsFilter === undefined) {
                continue;
            }

            if (tagsFilter instanceof And) {
                tagsFilters.push(...tagsFilter.and);
                continue;
            }

            if (tagsFilter instanceof Tag) {
                if (keyValues[tagsFilter.key] === undefined) {
                    keyValues[tagsFilter.key] = [];
                }
                keyValues[tagsFilter.key].push(...tagsFilter.value.split(";"));
                continue;
            }

            console.error("Invalid type to flatten the multiAnswer", tagsFilter);
            throw "Invalid type to FlattenMultiAnswer"
        }
        return keyValues;
    }

    /**
     * Given multiple tagsfilters which can be used as answer, will take the tags with the same keys together as set.
     * E.g:
     *
     * FlattenMultiAnswer([and: [ "x=a", "y=0;1"], and: ["x=b", "y=2"], and: ["x=", "y=3"]])
     * will result in
     * ["x=a;b", "y=0;1;2;3"]
     *
     * @param tagsFilters
     * @constructor
     */
    static FlattenMultiAnswer(tagsFilters: TagsFilter[]): And {
        if (tagsFilters === undefined) {
            return new And([]);
        }

        let keyValues = TagUtils.SplitKeys(tagsFilters);
        const and: TagsFilter[] = []
        for (const key in keyValues) {
            and.push(new Tag(key, Utils.Dedup(keyValues[key]).join(";")));
        }
        return new And(and);
    }

    static MatchesMultiAnswer(tag: TagsFilter, tags: any): boolean {
        const splitted = TagUtils.SplitKeys([tag]);
        for (const splitKey in splitted) {
            const neededValues = splitted[splitKey];
            if (tags[splitKey] === undefined) {
                return false;
            }

            const actualValue = tags[splitKey].split(";");
            for (const neededValue of neededValues) {
                if (actualValue.indexOf(neededValue) < 0) {
                    return false;
                }
            }
        }
        return true;
    }
}