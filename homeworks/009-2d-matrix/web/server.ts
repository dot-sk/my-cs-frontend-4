import index from "./index.html";

Bun.serve({
  port: 3009,
  routes: {
    "/": index,
    /**
     * Прокси к NASA images-assets, чтобы canvas был same-origin
     * и getImageData не утыкался в CORS-taint.
     *
     * Тело отдается как ReadableStream без буферизации – Bun пайпит апстрим
     * прямо в сокет клиента. Передаем content-length, etag, last-modified –
     * с ними браузер показывает прогресс и умеет 304-кешировать
     */
    "/nasa/:id": async (req) => {
      const id = req.params.id;
      if (!/^[a-z0-9]+$/i.test(id)) {
        return new Response("bad id", { status: 400 });
      }

      const target = `https://images-assets.nasa.gov/image/${id}/${id}~large.jpg`;
      const conditional = new Headers();
      const inm = req.headers.get("if-none-match");
      const ims = req.headers.get("if-modified-since");
      if (inm) conditional.set("if-none-match", inm);
      if (ims) conditional.set("if-modified-since", ims);

      const upstream = await fetch(target, { headers: conditional });
      if (upstream.status === 304) {
        return new Response(null, { status: 304 });
      }
      if (!upstream.ok || !upstream.body) {
        return new Response(`upstream ${upstream.status}`, {
          status: upstream.status,
        });
      }

      const headers = new Headers();
      for (const h of [
        "content-type",
        "content-length",
        "etag",
        "last-modified",
        "accept-ranges",
      ]) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      headers.set("cache-control", "public, max-age=86400");

      return new Response(upstream.body, { headers });
    },
  },
  development: { hmr: true, console: true },
});

console.log("http://localhost:3009");
