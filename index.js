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
          html = html.replace(/(href|src)=["'](\/[^"']*)["']/g, (match, attr, path) => {
            const base = new URL(target).origin;
            return `${attr}="${base}${path}"`;
          });
          html = html.replace(/(href|src)=["'](?!http)([^"']*)["']/g, (match, attr, path) => {
            const base = new URL(target).origin + "/";
            return `${attr}="${base}${path}"`;
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
<head><title>Proxy Browser</title></head>
<body>
  <form id="proxyForm">
    <input type="url" id="urlInput" placeholder="Enter URL..." required>
    <button type="submit">Go</button>
  </form>
  <iframe id="proxyFrame" style="width:100%; height:90vh;"></iframe>
  <script>
    document.getElementById('proxyForm').addEventListener('submit', e => {
      e.preventDefault();
      const url = document.getElementById('urlInput').value;
      document.getElementById('proxyFrame').src = '/proxy?url=' + encodeURIComponent(url);
    });
  </script>
</body>
</html>
`;
}
