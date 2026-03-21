// Вариант 1: фиксированная длина кодов, 8 бит на символ
// Каждый символ кодируется ровно одним байтом
//
// Старшие 2 бита - номер страницы:
//   00 - нижний регистр
//   01 - верхний регистр
//   10 - цифры
//   11 - знаки препинания и управляющие символы
// Младшие 6 бит - индекс символа внутри страницы
//
// Например:
//   0b00_000000 - "а"
//   0b00_000001 - "б"
//   0b01_000000 - "А"
//   0b10_000000 - "0"
//   0b11_011010 - " "

import { ALPHABET } from "./constants.ts";

// диапазоны символов в ALPHABET: [откуда начинается, сколько символов]
// порядок страниц: нижний регистр, верхний регистр, цифры, пунктуация+управляющие
const PAGES = [
  { start: 33, length: 33 },
  { start: 0, length: 33 },
  { start: 66, length: 10 },
  { start: 76, length: 29 },
] as const;

// сдвиг на 6 бит, чтобы добраться до номера страницы в старших 2 битах
const PAGE_SHIFT = 6;
// маска для извлечения номера страницы (2 бита)
const PAGE_MASK = 0b11;
// маска для извлечения индекса внутри страницы (младшие 6 бит)
const INDEX_MASK = 0b00111111;

export function encodeSymbol(symbol: string): number {
  const alphabetIndex = ALPHABET.indexOf(symbol);

  if (alphabetIndex === -1) {
    throw new Error(`Символ ${JSON.stringify(symbol)} не поддерживается схемой кодирования`);
  }

  for (const [pageIndex, page] of PAGES.entries()) {
    const symbolIndex = alphabetIndex - page.start;

    if (symbolIndex >= 0 && symbolIndex < page.length) {
      // склеиваем номер страницы и индекс в один байт
      return (pageIndex << PAGE_SHIFT) | symbolIndex;
    }
  }

  throw new Error(`Символ ${JSON.stringify(symbol)} не попал ни в одну страницу кодирования`);
}

export function decodeSymbol(byte: number): string {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
    throw new Error(`Ожидался байт в диапазоне 0-255, получено: ${byte}`);
  }

  // достаем номер страницы из старших 2 бит
  const pageIndex = (byte >> PAGE_SHIFT) & PAGE_MASK;
  // достаем индекс символа из младших 6 бит
  const symbolIndex = byte & INDEX_MASK;
  const page = PAGES[pageIndex];

  if (page === undefined) {
    throw new Error(`Страница ${pageIndex} отсутствует в схеме кодирования`);
  }

  if (symbolIndex >= page.length) {
    throw new Error(`Индекс ${symbolIndex} выходит за пределы страницы ${pageIndex}`);
  }

  const symbol = ALPHABET[page.start + symbolIndex];

  if (symbol === undefined) {
    throw new Error(`Байт ${byte} не соответствует ни одному символу в схеме кодирования`);
  }

  return symbol;
}

export function encodeText(text: string): Uint8Array {
  return Uint8Array.from(text, encodeSymbol);
}

export function decodeText(bytes: Uint8Array): string {
  return Array.from(bytes, decodeSymbol).join("");
}

for (const symbol of ALPHABET) {
  encodeSymbol(symbol);
}
