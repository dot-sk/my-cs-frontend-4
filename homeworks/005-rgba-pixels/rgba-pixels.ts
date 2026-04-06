type RGBA = [red: number, green: number, blue: number, alpha: number];
type RGBAObject = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

export enum TraverseMode {
  RowMajor,
  ColMajor,
}

/**
 * Out и In разделены, чтобы get() мог возвращать subarray view (zero-copy),
 * а set() принимал примитив — без аллокации typed array на каждый пиксель
 * в горячем цикле (как в three.js DataTexture)
 */
interface Image<Out, In = Out> {
  width: number;
  height: number;

  get(x: number, y: number): Out;
  set(x: number, y: number, value: In): void;
}

export class FlatArrayImage implements Image<RGBA> {
  data: number[];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Array(width * height * 4).fill(0).map((_, i) => i % 255);
  }

  get(x: number, y: number): RGBA {
    const pixel = [0, 0, 0, 0] as RGBA;
    const baseIndex = (y * this.width + x) * 4;
    for (let i = 0; i < 4; i++) {
      pixel[i] = this.data[baseIndex + i];
    }
    return pixel;
  }

  set(x: number, y: number, rgba: RGBA): void {
    const baseIndex = (y * this.width + x) * 4;
    for (let i = 0; i < 4; i++) {
      this.data[baseIndex + i] = rgba[i];
    }
  }
}

export class ArrayOfArraysImage implements Image<RGBA> {
  data: RGBA[];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Array(width * height).fill(0).map((_, i) => {
      return [i % 255, i % 255, i % 255, 1];
    });
  }

  get(x: number, y: number): RGBA {
    const index = y * this.width + x;
    return [...this.data[index]];
  }

  set(x: number, y: number, rgba: RGBA): void {
    const index = y * this.width + x;
    this.data[index] = rgba;
  }
}

export class ArrayOfObjectsImage implements Image<RGBA> {
  data: RGBAObject[];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Array(width * height).fill(0).map((_, i) => ({
      red: i & 0xff, // clamp to 0-255
      green: i & 0xff,
      blue: i & 0xff,
      alpha: 1,
    }));
  }

  get(x: number, y: number): RGBA {
    const index = y * this.width + x;
    const pixel = this.data[index];
    return [pixel.red, pixel.green, pixel.blue, pixel.alpha];
  }

  set(x: number, y: number, rgba: RGBA): void {
    const index = y * this.width + x;
    const [red, green, blue, alpha] = rgba;
    this.data[index] = { red, green, blue, alpha };
  }
}

export class Uint32Image implements Image<Uint32Array, number> {
  static pack(r: number, g: number, b: number, a: number): number {
    return (
      ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)
    );
  }

  data: Uint32Array;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Uint32Array(width * height).map((_, i) => {
      return Uint32Image.pack(i & 0xff, i & 0xff, i & 0xff, 0xff);
    });
  }

  get(x: number, y: number) {
    const index = y * this.width + x;
    return this.data.subarray(index, index + 1);
  }

  set(x: number, y: number, value: number): void {
    const index = y * this.width + x;
    this.data[index] = value;
  }
}

export class Uint8ClampedImage implements Image<RGBA> {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Uint8ClampedArray(width * height * 4)
      .fill(0)
      .map((_, i) => i);
  }

  /**
   * Возвращаем RGBA тупл, а не subarray view
   *
   * subarray() выглядит как zero-copy, но каждый вызов аллоцирует новый
   * TypedArray view-объект (заголовок + ссылка на ArrayBuffer). В per-pixel
   * цикле это миллионы аллокаций – на 2048x2048 это ~4M view-объектов
   *
   * subarray уместен для передачи целых регионов буфера (как в three.js
   * gl.texSubImage2D), где один вызов покрывает тысячи пикселей.
   * Для поэлементного доступа plain array тупл дешевле
   */
  get(x: number, y: number): RGBA {
    const baseIndex = (y * this.width + x) * 4;
    return [
      this.data[baseIndex],
      this.data[baseIndex + 1],
      this.data[baseIndex + 2],
      this.data[baseIndex + 3],
    ];
  }

  set(x: number, y: number, rgba: RGBA): void {
    const baseIndex = (y * this.width + x) * 4;
    for (let i = 0; i < 4; i++) {
      this.data[baseIndex + i] = rgba[i];
    }
  }
}

export interface PixelStream<Out, In = Out> {
  getPixel(x: number, y: number): Out;
  setPixel(x: number, y: number, value: In): void;
  forEach(
    mode: TraverseMode,
    callback: (pixel: Out, x: number, y: number) => void,
  ): void;
}

export class PixelStream<Out, In = Out> implements PixelStream<Out, In> {
  constructor(private image: Image<Out, In>) {}

  getPixel(x: number, y: number): Out {
    return this.image.get(x, y);
  }

  setPixel(x: number, y: number, value: In): void {
    this.image.set(x, y, value);
  }

  forEach(
    mode: TraverseMode,
    callback: (pixel: Out, x: number, y: number) => void,
  ): void {
    if (mode === TraverseMode.RowMajor) {
      for (let y = 0; y < this.image.height; y++) {
        for (let x = 0; x < this.image.width; x++) {
          const pixel = this.getPixel(x, y);
          callback(pixel, x, y);
        }
      }
    } else if (mode === TraverseMode.ColMajor) {
      for (let x = 0; x < this.image.width; x++) {
        for (let y = 0; y < this.image.height; y++) {
          const pixel = this.getPixel(x, y);
          callback(pixel, x, y);
        }
      }
    }
  }
}
