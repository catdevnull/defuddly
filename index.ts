import { Defuddle } from "defuddle";
import { JSDOM } from "jsdom";
import { askFxtwitter, renderFxtwitter } from "./fxtwitter";

const globalDom = new JSDOM();
global.document = globalDom.window.document;
global.HTMLImageElement = globalDom.window.HTMLImageElement;
global.SVGElement = globalDom.window.SVGElement;
global.window = globalDom.window as unknown as Window & typeof globalThis;
global.NodeFilter = globalDom.window.NodeFilter;
global.Node = globalDom.window.Node;
global.Document = globalDom.window.Document;
global.DocumentFragment = globalDom.window.DocumentFragment;
global.Element = globalDom.window.Element;
global.Text = globalDom.window.Text;
global.Comment = globalDom.window.Comment;
global.CSSMediaRule = globalDom.window.CSSMediaRule;
global.CSSStyleRule = globalDom.window.CSSStyleRule;

const server = Bun.serve({
  async fetch(req) {
    try {
      const url = new URL(req.url);
      const path = url.pathname.slice(1); // Remove the leading slash

      // If no path is provided, return a simple HTML form
      if (!path) {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Defuddle Proxy</title>
              <style>
                html { color-scheme: dark light; }
                body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
                form { display: flex; gap: 1rem; margin-bottom: 2rem; }
                input { flex: 1; padding: 0.5rem; }
                button { padding: 0.5rem 1rem; }
              </style>
            </head>
            <body>
              <h1>Defuddle Content Extractor</h1>
              <form action="/" method="get" onsubmit="event.preventDefault(); window.location.href = '/' + document.getElementById('url').value;">
                <input id="url" type="url" placeholder="Enter URL to extract (e.g. https://example.com)" required />
                <button type="submit">Extract</button>
              </form>
              <p>Enter a URL in the input field above to extract its main content.</p>
            </body>
          </html>
        `,
          {
            headers: { "Content-Type": "text/html" },
          }
        );
      }

      let targetUrl;
      targetUrl = decodeURIComponent(path);
      let html: string;

      if (targetUrl.includes("x.com")) {
        html = await renderFxtwitter(targetUrl);
      } else {
        try {
          new URL(targetUrl);
        } catch (e) {
          return new Response(`Invalid URL: ${targetUrl}`, { status: 400 });
        }

        console.log(`Fetching: ${targetUrl}`);

        // Fetch the URL
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (!response.ok) {
          return new Response(
            `Failed to fetch URL: ${response.status} ${response.statusText}`,
            { status: response.status }
          );
        }

        html = await response.text();
      }

      const rewriter = new HTMLRewriter()
        .on("a", {
          element(element) {
            if (element.hasAttribute("data-no-proxy")) {
              return;
            }
            const href = element.getAttribute("href");
            if (href) {
              try {
                const absoluteUrl = new URL(href, targetUrl).href;
                element.setAttribute("href", absoluteUrl);
                element.after(
                  `<a href="/${encodeURIComponent(
                    absoluteUrl
                  )}" target="_blank" style="margin-left: 0.5em; font-size: 0.8em;">(proxy)</a>`,
                  { html: true }
                );
              } catch (error) {
                console.warn(`Could not resolve URL: ${href}`, error);
              }
            }
          },
        })
        .on("img", {
          element(element) {
            const src = element.getAttribute("src");
            if (src) {
              try {
                const absoluteUrl = new URL(src, targetUrl).href;
                element.setAttribute("src", absoluteUrl);
              } catch (error) {
                console.warn(`Could not resolve URL: ${src}`, error);
              }
            }
          },
        });
      const dom = new JSDOM(rewriter.transform(html), { url: targetUrl });

      const article = new Defuddle(dom.window.document).parse();

      // Return the extracted content in a nice HTML wrapper
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${article.title || "Extracted Content"}</title>
            <style>
              html { color-scheme: dark light; }
              body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
              .source { margin-bottom: 2rem; color: #555; border: 1px solid #ccc; padding: 1rem; }
              @media (prefers-color-scheme: dark) {
                .source { background-color: #111; color: #ddd; border-color: #333; }
              }
              h1 { margin-bottom: 1.5rem; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <div class="source">
              Source: <a href="${targetUrl}" target="_blank">${targetUrl}</a>
              <br>
              <a href="/">← Back to form</a>
            </div>
            <h1>${article.title || "Extracted Content"}</h1>
            <div class="content">
              ${article.content || "No content could be extracted"}
            </div>
          </body>
        </html>
      `,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    } catch (error: any) {
      console.error("Server error:", error);
      return new Response(`Server error: ${error.message}`, { status: 500 });
    }
  },
});

console.log(`Defuddle proxy server running at http://localhost:${server.port}`);
