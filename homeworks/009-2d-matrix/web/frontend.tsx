import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { Matrix2D } from "../009-2d-matrix";
import { RGBA } from "../shared/rgba";

import "../../../styles/globals.built.css";

type XY = { x: number; y: number };

/**
 * Подборка снимков с миссии Artemis II
 * https://www.nasa.gov/gallery/lunar-flyby/
 * Тянутся через /nasa/:id (server-side прокси к images-assets.nasa.gov)
 */
const NASA_PHOTOS = [
  { id: "art002e012090", title: "Луна крупно" },
  { id: "art002e012093", title: "Бассейн Герцшпрунга" },
  { id: "art002e009289", title: "Лунные кратеры" },
  { id: "art002e009282", title: "Кратер Вавилова" },
  { id: "art002e012028", title: "Видимая сторона" },
  { id: "art002e015231", title: "Земля над горизонтом" },
  { id: "art002e009567", title: "Луна и Земля в кадре" },
  { id: "art002e021278", title: "Восход Земли" },
] as const;

function App() {
  const [image, setImage] = useState<ImageData | null>(null);
  const [hover, setHover] = useState<XY | null>(null);
  const [selected, setSelected] = useState<XY | null>(null);
  const [fillColor, setFillColor] = useState("#ffffff");
  const [, forceRender] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const matrix = useMemo(() => {
    if (!image) return null;
    return new Matrix2D(image.width, image.height, RGBA, image.data);
  }, [image]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.putImageData(image, 0, 0);
  }, [image]);

  const repaint = () => {
    if (!image || !canvasRef.current) return;
    canvasRef.current.getContext("2d")!.putImageData(image, 0, 0);
    forceRender((v) => v + 1);
  };

  const setImageFromBitmap = (bitmap: ImageBitmap) => {
    const off = document.createElement("canvas");
    off.width = bitmap.width;
    off.height = bitmap.height;
    const ctx = off.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    setImage(ctx.getImageData(0, 0, bitmap.width, bitmap.height));
    setSelected(null);
    setHover(null);
  };

  const handleFile = async (file: File) => {
    setImageFromBitmap(await createImageBitmap(file));
  };

  const loadFromUrl = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
    setImageFromBitmap(await createImageBitmap(await res.blob()));
  };

  const eventToXY = (e: React.MouseEvent<HTMLCanvasElement>): XY | null => {
    if (!canvasRef.current || !image) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * image.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * image.height);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
    return { x, y };
  };

  const fill = () => {
    if (!matrix) return;
    matrix.fill(fillColor as `#${string}`);
    repaint();
  };

  const setChannel = (
    channel: "red" | "green" | "blue" | "alpha",
    value: number,
  ) => {
    if (!matrix || !selected) return;
    matrix.view(selected.x, selected.y)[channel] = value;
    repaint();
  };

  const hoverPixel = hover && matrix ? matrix.view(hover.x, hover.y) : null;
  const selPixel =
    selected && matrix ? matrix.view(selected.x, selected.y) : null;

  const exportBin = () => {
    if (!image) return;
    const bin = new Uint8Array(8 + image.data.byteLength);
    const dv = new DataView(bin.buffer);
    dv.setUint32(0, image.width, true);
    dv.setUint32(4, image.height, true);
    bin.set(image.data, 8);
    download(bin, "image.bin", "application/octet-stream");
  };

  const exportFlat = () => {
    if (!image) return;
    const obj = {
      width: image.width,
      height: image.height,
      data: Array.from(image.data),
    };
    download(JSON.stringify(obj), "image.flat.json", "application/json");
  };

  const exportNested = () => {
    if (!image) return;
    const pixels: number[][] = new Array(image.width * image.height);
    for (let i = 0; i < pixels.length; i++) {
      const o = i * 4;
      pixels[i] = [
        image.data[o],
        image.data[o + 1],
        image.data[o + 2],
        image.data[o + 3],
      ];
    }
    const obj = { width: image.width, height: image.height, pixels };
    download(JSON.stringify(obj), "image.nested.json", "application/json");
  };

  return (
    <div className="mx-auto max-w-7xl p-4 text-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Matrix2D viewer
      </h1>
      <p className="mb-4 font-mono text-xs text-muted-foreground">
        canvas → getImageData → Matrix2D&lt;RGBATuple, RGBAInput, RGBARef&gt;
      </p>

      <div className="mb-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Artemis II – фото с лунного пролета
        </p>
        <div className="flex flex-wrap gap-2">
          {NASA_PHOTOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void loadFromUrl(`/nasa/${p.id}`)}
              className={btnClass}
              title={p.id}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          или свой файл
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="text-xs"
        />
      </div>

      {image && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <canvas
              ref={canvasRef}
              onMouseMove={(e) => setHover(eventToXY(e))}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => setSelected(eventToXY(e))}
              className="block w-full cursor-crosshair"
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          <div className="space-y-4 font-mono text-xs">
            <Panel title="Матрица">
              <Row k="size">
                {image.width}×{image.height}
              </Row>
              <Row k="BYTES_PER_ELEMENT">{matrix?.BYTES_PER_ELEMENT}</Row>
              <Row k="buffer.byteLength">{matrix?.buffer.byteLength}</Row>
            </Panel>

            <Panel title="Под курсором">
              {hover && hoverPixel ? (
                <>
                  <Row k="x, y">
                    {hover.x}, {hover.y}
                  </Row>
                  <Row k="rgba">
                    [{hoverPixel.red}, {hoverPixel.green}, {hoverPixel.blue},{" "}
                    {hoverPixel.alpha}]
                  </Row>
                </>
              ) : (
                <p className="text-muted-foreground">наведи курсор на canvas</p>
              )}
            </Panel>

            <Panel title="Выбран">
              {selected && selPixel ? (
                <>
                  <Row k="x, y">
                    {selected.x}, {selected.y}
                  </Row>
                  <ChannelSlider
                    name="red"
                    value={selPixel.red}
                    onChange={(v) => setChannel("red", v)}
                  />
                  <ChannelSlider
                    name="green"
                    value={selPixel.green}
                    onChange={(v) => setChannel("green", v)}
                  />
                  <ChannelSlider
                    name="blue"
                    value={selPixel.blue}
                    onChange={(v) => setChannel("blue", v)}
                  />
                  <ChannelSlider
                    name="alpha"
                    value={selPixel.alpha}
                    onChange={(v) => setChannel("alpha", v)}
                  />
                  <p className="pt-1 text-[10px] text-muted-foreground">
                    редактирование идет через matrix.view(x, y).red = v
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">кликни по пикселю</p>
              )}
            </Panel>

            <Panel title="Заливка">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="h-8 w-12 rounded border border-border bg-transparent"
                />
                <span>{fillColor}</span>
                <button
                  type="button"
                  onClick={fill}
                  className="ml-auto rounded bg-primary px-3 py-1 text-primary-foreground hover:bg-primary/90"
                >
                  fill
                </button>
              </div>
              <p className="pt-1 text-[10px] text-muted-foreground">
                matrix.fill(&quot;#rrggbb&quot;)
              </p>
            </Panel>

            <Panel title="Экспорт фикстур для бенча">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={exportBin} className={btnClass}>
                  bin
                </button>
                <button onClick={exportFlat} className={btnClass}>
                  flat.json
                </button>
                <button onClick={exportNested} className={btnClass}>
                  nested.json
                </button>
              </div>
              <p className="pt-1 text-[10px] text-muted-foreground">
                bin = u32 width LE + u32 height LE + raw RGBA
              </p>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

const btnClass =
  "rounded border border-border bg-muted/30 px-3 py-1 hover:bg-muted/60";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <h2 className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span>{children}</span>
    </div>
  );
}

function ChannelSlider({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-12 text-muted-foreground">{name}</span>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1"
      />
      <span className="w-8 text-right tabular-nums">{value}</span>
    </label>
  );
}

function download(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

createRoot(document.getElementById("root")!).render(<App />);
