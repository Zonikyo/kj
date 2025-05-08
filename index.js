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
        const fetchedResponse = await fetch(target);
        const contentType = fetchedResponse.headers.get("content-type") || "";

        if (contentType.includes("text/html")) {
          let html = await fetchedResponse.text();
          const base = new URL(target).origin;

          html = html.replace(/\b(href|src|action)=([\"'])(.*?)\2/gi, (match, attr, quote, val) => {
            if (val.startsWith("data:")) return match;
            const absolute = new URL(val, target).toString();
            return `${attr}=${quote}/proxy?url=${encodeURIComponent(absolute)}${quote}`;
          });

          if (!/<base /i.test(html)) {
            html = html.replace(/<head.*?>/, (match) => `${match}<base href="${base}/">`);
          }

          if (!/<meta charset/i.test(html)) {
            html = html.replace(/<head.*?>/, (match) => `${match}<meta charset="UTF-8">`);
          }

          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=UTF-8" },
          });
        }

        return new Response(fetchedResponse.body, {
          headers: { "Content-Type": contentType },
        });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }

    return new Response("404 Not Found", { status: 404 });
  },
};

async function getHomePage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Cloudflare Proxy Browser</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #1e1e2f;
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem;
      background: #2d2d3a;
    }
    .toolbar button, .toolbar input {
      border: none;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
    }
    .toolbar button {
      background: #444;
      color: white;
      cursor: pointer;
    }
    .toolbar input {
      flex: 1;
    }
    iframe {
      flex: 1;
      width: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="back">Back</button>
    <button id="forward">Forward</button>
    <button id="reload">Reload</button>
    <input id="urlBar" placeholder="Enter URL or search term">
    <button id="go">Go</button>
    <button id="popout">Open</button>
  </div>
  <iframe id="frame"></iframe>
  <script>
    const frame = document.getElementById("frame");
    const urlBar = document.getElementById("urlBar");
    const historyStack = [];
    let historyIndex = -1;

    function isURL(str) {
      try { new URL(str); return true; } catch { return false; }
    }

    function toURL(input) {
      if (isURL(input)) return input;
      return "https://duckduckgo.com/?q=" + encodeURIComponent(input);
    }

    function goTo(input) {
      const url = toURL(input);
      const proxied = "/proxy?url=" + encodeURIComponent(url);
      frame.src = proxied;
      historyStack.splice(historyIndex + 1);
      historyStack.push(url);
      historyIndex++;
      urlBar.value = url;
    }

    document.getElementById("go").onclick = () => goTo(urlBar.value);
    document.getElementById("back").onclick = () => {
      if (historyIndex > 0) {
        historyIndex--;
        const url = historyStack[historyIndex];
        frame.src = "/proxy?url=" + encodeURIComponent(url);
        urlBar.value = url;
      }
    };
    document.getElementById("forward").onclick = () => {
      if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const url = historyStack[historyIndex];
        frame.src = "/proxy?url=" + encodeURIComponent(url);
        urlBar.value = url;
      }
    };
    document.getElementById("reload").onclick = () => {
      if (historyIndex >= 0) {
        const url = historyStack[historyIndex];
        frame.src = "/proxy?url=" + encodeURIComponent(url);
      }
    };
    document.getElementById("popout").onclick = () => {
      if (historyIndex >= 0) {
        const url = historyStack[historyIndex];
        const popup = window.open("about:blank", "_blank");
        popup.document.write("<iframe src='/proxy?url=" + encodeURIComponent(url) + "' style='width:100%;height:100vh;border:none;'></iframe>");
      }
    };
    urlBar.addEventListener("keypress", e => {
      if (e.key === "Enter") goTo(urlBar.value);
    });
  </script>
</body>
</html>`;
}
