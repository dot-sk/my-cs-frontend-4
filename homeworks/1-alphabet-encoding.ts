/**
 * - Необходимо разработать схему кодирования для алфавита, состоящего из символов ALPHABET
 * - Главное требование: схема должна быть максимально экономичной по памяти
 * - Подсказка: необязательно кодировать все символы «как есть», как и необязательно делать фиксированный размер на символ
 */

const ALPHABET = [
  // Кириллица верхний регистр
  "А",
  "Б",
  "В",
  "Г",
  "Д",
  "Е",
  "Ё",
  "Ж",
  "З",
  "И",
  "Й",
  "К",
  "Л",
  "М",
  "Н",
  "О",
  "П",
  "Р",
  "С",
  "Т",
  "У",
  "Ф",
  "Х",
  "Ц",
  "Ч",
  "Ш",
  "Щ",
  "Ъ",
  "Ы",
  "Ь",
  "Э",
  "Ю",
  "Я",

  // Кириллица нижний регистр
  "а",
  "б",
  "в",
  "г",
  "д",
  "е",
  "ё",
  "ж",
  "з",
  "и",
  "й",
  "к",
  "л",
  "м",
  "н",
  "о",
  "п",
  "р",
  "с",
  "т",
  "у",
  "ф",
  "х",
  "ц",
  "ч",
  "ш",
  "щ",
  "ъ",
  "ы",
  "ь",
  "э",
  "ю",
  "я",

  // Цифры
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",

  // Знаки препинания
  ".",
  ",",
  "!",
  "?",
  ":",
  ";",
  "-",
  "'",
  '"',
  "(",
  ")",
  "[",
  "]",
  "/",
  "@",
  "#",
  "$",
  "%",
  "&",
  "*",
  "+",
  "=",
  "<",
  ">",
  "_",
  "|",

  // Управляющие символы
  " ", // пробел
  "\t", // табуляция
  "\n", // перевод строки
];

// Кодируем каждый символ в 1 байт
// Старшие 2 бита - номер страницы:
// 00 - нижний регистр
// 01 - верхний регистр
// 10 - цифры
// 11 - знаки препинания и управляющие символы
// Младшие 6 бит - индекс символа внутри страницы
//
// В памяти храним только один ALPHABET и диапазоны страниц в нем,
//
// Например:
// 0b00_000000 - "а"
// 0b00_000001 - "б"
// 0b01_000000 - "А"
// 0b10_000000 - "0"
// 0b11_011010 - " "
//
// Было бы эффективнее использовать 7 бит на символ, но тогда код будет сложнее читать и отлаживать,
// поэтому для простоты оставляю 1 байт на символ

const PAGES = [
  { start: 33, length: 33 },
  { start: 0, length: 33 },
  { start: 66, length: 10 },
  { start: 76, length: 29 },
] as const;

const PAGE_SHIFT = 6;
const PAGE_MASK = 0b11;
const INDEX_MASK = 0b00111111;

export function encodeSymbol(symbol: string): number {
  const alphabetIndex = ALPHABET.indexOf(symbol);

  if (alphabetIndex === -1) {
    throw new Error(`Символ ${JSON.stringify(symbol)} не поддерживается схемой кодирования`);
  }

  for (const [pageIndex, page] of PAGES.entries()) {
    const symbolIndex = alphabetIndex - page.start;

    if (symbolIndex >= 0 && symbolIndex < page.length) {
      return (pageIndex << PAGE_SHIFT) | symbolIndex;
    }
  }

  throw new Error(`Символ ${JSON.stringify(symbol)} не попал ни в одну страницу кодирования`);
}

export function decodeSymbol(byte: number): string {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
    throw new Error(`Ожидался байт в диапазоне 0-255, получено: ${byte}`);
  }

  const pageIndex = (byte >> PAGE_SHIFT) & PAGE_MASK;
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