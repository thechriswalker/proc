import hyperx from "hyperx";

type Thenable<T = any> = { then: (res: T) => any };

const isThenable = (x: any): x is Thenable =>
  x && x.then && typeof x.then === "function";

// need to flatten and make sure it is an array
const makeSpreadable = (x: any): Array<any> =>
  Array.isArray(x) ? x.flat(Infinity) : x ? [x] : [];

const asyncCreateElement = (
  tag: string,
  attrs: { [k: string]: any },
  kids: Array<any>
) => {
  const children = makeSpreadable(kids);
  // make sure everything is resolved.
  const promises: Array<Promise<any>> = [];
  Object.entries(attrs).forEach(([k, v]) => {
    if (isThenable(v)) {
      promises.push(
        v.then((res: any) => {
          attrs[k] = res;
        })
      );
    }
  });
  type ElementOf<T> = T extends Array<infer U> ? U : never;
  const scheduleChild = <T>(child: ElementOf<T>, i: number, arr: T) => {
    if (isThenable(child)) {
      promises.push(
        child.then((res: any) => {
          children[i] = res;
        })
      );
    } else if (Array.isArray(child)) {
      // recurse
      child.forEach(scheduleChild);
    }
  };
  children.forEach(scheduleChild);
  if (promises.length) {
    return Promise.all(promises).then(() => new Element(tag, attrs, children));
  }
  // the happy path is synchronous
  return new Element(tag, attrs, children);
};

const concat = (a: any, b: any) => {
  // resolve them all and then stringify
  if (!isThenable(a) && !isThenable(b)) {
    return `${a}${b}`;
  }
  return Promise.all([a, b]).then(([c, d]) => `${c}${d}`);
};

const createFragment = (children: Array<any>) => {
  return new Element(null, {}, makeSpreadable(children));
};

export const html = hyperx(asyncCreateElement, {
  concat,
  createFragment,
  attrToProp: false // we want the attributes, not the properties
});
export const render = async (
  tree: ReturnType<typeof html>
): Promise<string> => {
  return (await tree).render();
};
export type VDom = ReturnType<typeof html>;

// to implement my own renderer, just define how to escape stuff.

class Element {
  private attributes: Array<[string, any]>;
  private dangerousInnerHtml: string | false = false;

  constructor(
    private tag: string | null,
    attributes: {
      [k: string]: any;
    } | null,
    private children: Array<Element | string>
  ) {
    this.attributes = Object.entries(attributes || {}).filter(([k, v]) => {
      switch (k) {
        case "key":
        case "ref":
          // just ignore
          return false;
        case dangerousInnerHTMLAttr:
          // should be an object with `__html` property.
          if (
            typeof v !== "object" ||
            "__html" in v === false ||
            typeof v.__html !== "string"
          ) {
            throw new SyntaxError(
              `Use of '${dangerousInnerHTMLAttr}' without value as object with '__html' key`
            );
          }
          if (children.length !== 0) {
            throw new SyntaxError(
              `Use of both '${dangerousInnerHTMLAttr}' and child nodes`
            );
          }
          this.dangerousInnerHtml = v.__html;
          // remove from attribute list
          return false;
        default:
          // accept
          return true;
      }
    });
    if (this.tag === null && this.attributes.length !== 0) {
      throw new SyntaxError("Cannot have attributes on a fragment!");
    }
  }

  public render(): string {
    if (this.tag === null) {
      return this.content();
    }
    if (selfClosing(this.tag)) {
      return `<${this.tag}${this.attrs()}/>`;
    }
    return `<${this.tag}${this.attrs()}>${this.content()}</${this.tag}>`;
  }

  private attrs(): string {
    return this.attributes.reduce((s, [name, value]) => {
      switch (value) {
        case true:
        case false:
        case null:
        case undefined:
          return value ? s + " " + name : s;
        default:
          return `${s} ${name}=${safeAttributeValue(String(value))}`;
      }
    }, "");
  }

  private content(): string {
    if (this.dangerousInnerHtml !== false) {
      return this.dangerousInnerHtml;
    }
    // if the there is just whitesapce between two tags, we can remove the whitespace.
    // but this is harder to ascertain than it seems. but if we always trim contents,
    // it pretty much behaves correctly.
    return this.children
      .reduce<string>((s, c) => {
        if (c instanceof Element) {
          return s + c.render();
        }
        return s + safeHtmlValue(c);
      }, "")
      .trim();
  }
}

// safety functions! (the whole point)
const safeAttributeValue = (s: string): string => `"${safeHtmlValue(s)}"`;
const safeHtmlValue = (str: string): string =>
  String(str).replace(/[&<>"']/g, s => `&${entityMap[s]};`);
const entityMap: Record<string, string> = {
  "&": "amp",
  "<": "lt",
  ">": "gt",
  '"': "quot",
  "'": "apos"
};
const dangerousInnerHTMLAttr = "dangerouslySetInnerHTML";

// copied from hyperx!
// prettier-ignore
const closeRE = RegExp('^(' + [
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
  'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
  'source', 'track', 'wbr', '!--',
  // SVG TAGS
  'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
  'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
  'vkern'
].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$');
const selfClosing = (tag: string) => closeRE.test(tag);
