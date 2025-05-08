// Cloudflare Worker entry point
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

          // Rewrite all href/src/form/etc attributes
          html = html.replace(/(href|src|action)=["'](.*?)["']/gi, (match, attr, val) => {
            if (val.startsWith("data:")) return match;
            const absolute = new URL(val, target).toString();
            return `${attr}="/proxy?url=${encodeURIComponent(absolute)}"`;
          });

          // Rewrite JavaScript-driven navigation
          html = html.replace(/window\.location\.href\s*=\s*['"](.*?)['"]/g, (match, val) => {
            const absolute = new URL(val, target).toString();
            return `window.location.href='/proxy?url=${encodeURIComponent(absolute)}'`;
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

// Homepage UI
async function getHomePage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Cloudflare Proxy Browser</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      font-family: 'Segoe UI', sans-serif;
      background: #1e1e2f;
      color: #fff;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .toolbar {
      display: flex;
      align-items: center;
      background: #2c2c3c;
      padding: 0.5rem;
      gap: 0.5rem;
    }
    .toolbar button {
      background: #444;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-radius: 5px;
    }
    .toolbar input {
      flex: 1;
      padding: 0.5rem;
      border: none;
      border-radius: 5px;
    }
    iframe {
      flex: 1;
      border: none;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="back">Back</button>
    <button id="forward">Forward</button>
    <button id="reload">Reload</button>
    <input type="text" id="urlBar" placeholder="Enter URL or search...">
    <button id="go">Go</button>
    <button id="popout">Open</button>
  </div>
  <iframe id="frame"></iframe>

  <script>
    const frame = document.getElementById('frame');
    const urlBar = document.getElementById('urlBar');
    const historyStack = [];
    let historyIndex = -1;

    function toUrl(input) {
      try {
        return new URL(input).toString();
      } catch {
        return 'https://duckduckgo.com/?q=' + encodeURIComponent(input);
      }
    }

    function updateFrame(url) {
      const proxied = '/proxy?url=' + encodeURIComponent(url);
      frame.src = proxied;
      urlBar.value = url;
    }

    function goTo(input) {
      const url = toUrl(input);
      updateFrame(url);
      historyStack.splice(historyIndex + 1);
      historyStack.push(url);
      historyIndex++;
    }

    document.getElementById('go').onclick = () => goTo(urlBar.value);
    document.getElementById('back').onclick = () => {
      if (historyIndex > 0) {
        historyIndex--;
        updateFrame(historyStack[historyIndex]);
      }
    };
    document.getElementById('forward').onclick = () => {
      if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        updateFrame(historyStack[historyIndex]);
      }
    };
    document.getElementById('reload').onclick = () => {
      if (historyIndex >= 0) {
        updateFrame(historyStack[historyIndex]);
      }
    };
    document.getElementById('popout').onclick = () => {
      if (historyIndex >= 0) {
        const proxied = '/proxy?url=' + encodeURIComponent(historyStack[historyIndex]);
        const win = window.open('about:blank', '_blank');
        win.document.write('<iframe src="' + proxied + '" style="width:100%;height:100vh;border:none;"></iframe>');
      }
    };

    urlBar.addEventListener('keypress', e => {
      if (e.key === 'Enter') goTo(urlBar.value);
    });
  </script>
</body>
</html>`;
}
