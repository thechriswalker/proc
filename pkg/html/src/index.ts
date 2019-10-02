import hyperx from "hyperx";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const isThenable = (x: any): boolean =>
  x && x.then && typeof x.then === "function";

const makeSpreadable = (x: any): Array<any> =>
  Array.isArray(x) ? x : x ? [x] : [];

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
  children.forEach((child, i) => {
    if (isThenable(child)) {
      promises.push(
        child.then((res: any) => {
          children[i] = res;
        })
      );
    }
  });
  if (promises.length) {
    return Promise.all(promises).then(() =>
      createElement(tag, attrs, ...children)
    );
  }
  // the happy path is synchronous
  return createElement(tag, attrs, ...children);
};

const concat = (a: any, b: any) => {
  // resolve them all and then stringify
  if (!isThenable(a) && !isThenable(b)) {
    return `${a}${b}`;
  }
  return Promise.all([a, b]).then(([c, d]) => `${c}${d}`);
};

const createFragment = (children: Array<any>) => {
  return createElement(Fragment, {}, ...makeSpreadable(children));
};

export const html = hyperx(asyncCreateElement, { concat, createFragment });
export const render = async (
  tree: ReturnType<typeof html>
): Promise<string> => {
  return renderToStaticMarkup(await tree);
};
export type VDom = ReturnType<typeof html>;
