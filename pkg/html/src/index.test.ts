import { html, render } from "./";

describe("async template", () => {
  it("should render promises for children", async () => {
    await expect(
      render(
        html`
          <h1>${Promise.resolve("foo")}</h1>
        `
      )
    ).resolves.toBe(`<h1>foo</h1>`);
  });

  it("should render promises for attributes", async () => {
    await expect(
      render(
        html`
          <h1 id="${Promise.resolve("bar")}">foo</h1>
        `
      )
    ).resolves.toBe(`<h1 id="bar">foo</h1>`);
  });

  it("should render promises for child components", async () => {
    const inner = ({ text }: { text: string }) =>
      Promise.resolve(html`
        <span class="${Promise.resolve("quux")}">${Promise.resolve(text)}</span>
      `);

    await expect(
      render(
        html`
          <h1 id="${Promise.resolve("bar")}">foo ${inner({ text: "baz" })}</h1>
        `
      )
    ).resolves.toBe(`<h1 id="bar">foo <span class="quux">baz</span></h1>`);
  });

  it("should handle part-async attributes", async () => {
    await expect(
      render(
        html`
          <h1 id="foo-${Promise.resolve("bar")}">text</h1>
        `
      )
    ).resolves.toBe(`<h1 id="foo-bar">text</h1>`);
  });

  it("should handle empty elements", async () => {
    await expect(
      render(
        html`
          <a name="foo"></a>
        `
      )
    ).resolves.toBe(`<a name="foo"></a>`);
  });

  it("should handle array insertions", async () => {
    await expect(
      render(
        html`
          <ul>
            ${Array.from({ length: 3 }).map(
              (_, i) =>
                html`
                  <li key="${i}">item:${i}</li>
                `
            )}
          </ul>
        `
      )
    ).resolves.toBe(`<ul>
            <li>item:0</li><li>item:1</li><li>item:2</li>
          </ul>`);
  });

  it("should cope with multiple root nodes / fragments", async () => {
    await expect(
      render(
        // prettier-ignore
        html`<div>1</div><div>2</div>`
      )
    ).resolves.toBe(`<div>1</div><div>2</div>`);
    await expect(
      render(
        // prettier-ignore
        html`<><div>1</div><div>2</div></>`
      )
    ).resolves.toBe(`<div>1</div><div>2</div>`);
  });
});
