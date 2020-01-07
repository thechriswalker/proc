declare module "hyperx" {
  export default function hyperx<VDOM extends (...args: any[]) => any>(
    x: VDOM,
    options: {
      concat: (a: any, b: any) => any;
      createFragment: (children: any[]) => any;
      attrToProp: boolean;
    }
  ): (s: TemplateStringsArray, ...v: any[]) => ReturnType<VDOM>;
}
