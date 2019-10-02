# async html tagged template for rendering on the server.

Basically a tiny wrapper around `hyperx` and `virtual-dom` to allow attributes and
children to be promises.

## Usage

```typescript
import { html, render } from "@proc/html";

const title = "<Example>";

const someAsyncTask = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve("delayed");
    }, Math.random() * 1000);
  });
};

const template = html`
  <html>
    <body>
      <h1>${title}</h1>
      <p>
        ${someAsyncTask().then(
          text =>
            html`
              it's <strong>${text}</strong>!
            `
        )}
      </p>
    </body>
  </html>
`;

render(template).then(rawHTML => {
  console.log(rawHTML);
});
```
