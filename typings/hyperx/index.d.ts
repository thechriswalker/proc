declare module "hyperx" {
  export default function hyperx<VDOM extends (...args: any[]) => any>(
    x: VDOM,
    options: {
      concat: (a: any, b: any) => any;
      createFragment: (children: any[]) => any;
    }
  ): (s: TemplateStringsArray, ...v: any[]) => ReturnType<VDOM>;
}
