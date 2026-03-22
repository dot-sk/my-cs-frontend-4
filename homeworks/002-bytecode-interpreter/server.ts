import index from "./index.html";

const samplesDir = new URL("./samples", import.meta.url).pathname;

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/samples/*": async (req) => {
      const url = new URL(req.url);
      const filename = decodeURIComponent(
        url.pathname.replace("/samples/", ""),
      );
      const file = Bun.file(`${samplesDir}/${filename}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "audio/wav" },
        });
      }
      return new Response("Not found", { status: 404 });
    },
  },
});

console.log("http://localhost:3000");
