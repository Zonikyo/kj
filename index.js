export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(await getHomePage(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/proxy") {
      const target = url.searchParams.get("url");
      if (!target) {
        return new Response("Missing 'url' parameter", { status: 400 });
      }

      try {
        const response = await fetch(target);
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("text/html")) {
          let html = await response.text();
          const base = new URL(target).origin;

          html = html.replace(/(href|src)=["'](\/[^"']*)["']/g, (match, attr, path) => {
            return `${attr}="/proxy?url=${base}${path}"`;
          });

          html = html.replace(/(href|src)=["'](?!https?:\/\/|\/)([^"']+)["']/g, (match, attr, path) => {
            const resolved = new URL(path, target).toString();
            return `${attr}="/proxy?url=${resolved}"`;
          });

          html = html.replace(/(src|href)=["'](https?:\/\/[^"']+)["']/g, (match, attr, url) => {
            return `${attr}="/proxy?url=${encodeURIComponent(url)}"`;
          });

          html = html.replace(/<iframe[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/g, (match, url) => {
            return match.replace(url, `/proxy?url=${encodeURIComponent(url)}`);
          });

          html = html.replace(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/g, (match, url) => {
            return match.replace(url, `/proxy?url=${encodeURIComponent(url)}`);
          });

          return new Response(html, {
            headers: { "Content-Type": "text/html" },
          });
        }

        return new Response(response.body, {
          headers: { "Content-Type": contentType || "application/octet-stream" },
        });

      } catch (e) {
        return new Response("Error fetching site: " + e.message, { status: 500 });
      }
    }

    return new Response("404 Not Found", { status: 404 });
  }
};

async function getHomePage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Cloudflare Proxy Browser</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 0;
      background: #f4f4f4;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    #controls {
      display: flex;
      gap: 0.5rem;
      padding: 10px;
      background: #fff;
      border-bottom: 1px solid #ccc;
      align-items: center;
    }
    input[type="text"] {
      flex: 1;
      padding: 8px;
      font-size: 16px;
    }
    button {
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
    }
    #frame {
      flex: 1;
      border: none;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="controls">
    <button id="back">⬅️</button>
    <button id="forward">➡️</button>
    <button id="reload">🔄</button>
    <input type="text" id="urlBar" placeholder="Enter URL or search...">
    <button id="go">Go</button>
    <button id="popout">🧾</button>
  </div>
  <iframe id="frame"></iframe>

  <script>
    const historyStack = [];
    let historyIndex = -1;
    const frame = document.getElementById('frame');
    const urlBar = document.getElementById('urlBar');

    function navigateTo(input) {
      let url;
      try {
        url = new URL(input);
      } catch {
        // Not a valid URL — treat as search
        url = new URL('https://duckduckgo.com/');
        url.searchParams.set('q', input);
      }

      const proxyUrl = '/proxy?url=' + encodeURIComponent(url.toString());

      frame.src = proxyUrl;
      urlBar.value = url.toString();

      if (historyIndex === -1 || historyStack[historyIndex] !== url.toString()) {
        historyStack.splice(historyIndex + 1);
        historyStack.push(url.toString());
        historyIndex++;
      }
    }

    document.getElementById('go').onclick = () => navigateTo(urlBar.value);
    document.getElementById('back').onclick = () => {
      if (historyIndex > 0) {
        historyIndex--;
        navigateTo(historyStack[historyIndex]);
      }
    };
    document.getElementById('forward').onclick = () => {
      if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        navigateTo(historyStack[historyIndex]);
      }
    };
    document.getElementById('reload').onclick = () => {
      if (historyIndex >= 0) {
        navigateTo(historyStack[historyIndex]);
      }
    };
    document.getElementById('popout').onclick = () => {
      if (historyIndex >= 0) {
        const url = '/proxy?url=' + encodeURIComponent(historyStack[historyIndex]);
        const win = window.open('about:blank', '_blank');
        win.document.write('<iframe src="' + url + '" style="width:100%;height:100vh;border:none;"></iframe>');
      }
    };

    document.getElementById('urlBar').addEventListener('keypress', e => {
      if (e.key === 'Enter') navigateTo(urlBar.value);
    });
  </script>
</body>
</html>
`;
}
