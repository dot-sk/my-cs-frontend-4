import { BitStream } from "./bit-stream.ts";
import type { EncodedText } from "./types.ts";

// Формат кода: [префикс 2 бита][индекс N бит]
// Префикс 00 (4 бита) — самые частые символы (пробел, о, е, а)
// Префикс 01 (5 бит) — частые (и, н, т, с, р, в, л, к)
// Префикс 10 (6 бит) — средние (м, д, п, у, я, ы, ь, г, з, б, ч, й, ж, х, ш, ю)
// Префикс 11 (9 бит) — все остальные (fallback по индексу в алфавите)

type EncodedSymbol = Readonly<{
  bits: number;
  bitLength: number;
}>;

// символ → { bits, bitLength }
const ENCODE_TABLE = new Map<string, EncodedSymbol>([
  // префикс 00: 4 бита (пробел + топ 3 буквы)
  [" ", { bits: 0b00_00, bitLength: 4 }],
  ["о", { bits: 0b00_01, bitLength: 4 }],
  ["е", { bits: 0b00_10, bitLength: 4 }],
  ["а", { bits: 0b00_11, bitLength: 4 }],

  // префикс 01: 5 бит
  ["и", { bits: 0b01_000, bitLength: 5 }],
  ["н", { bits: 0b01_001, bitLength: 5 }],
  ["т", { bits: 0b01_010, bitLength: 5 }],
  ["с", { bits: 0b01_011, bitLength: 5 }],
  ["р", { bits: 0b01_100, bitLength: 5 }],
  ["в", { bits: 0b01_101, bitLength: 5 }],
  ["л", { bits: 0b01_110, bitLength: 5 }],
  ["к", { bits: 0b01_111, bitLength: 5 }],

  // префикс 10: 6 бит
  ["м", { bits: 0b10_0000, bitLength: 6 }],
  ["д", { bits: 0b10_0001, bitLength: 6 }],
  ["п", { bits: 0b10_0010, bitLength: 6 }],
  ["у", { bits: 0b10_0011, bitLength: 6 }],
  ["я", { bits: 0b10_0100, bitLength: 6 }],
  ["ы", { bits: 0b10_0101, bitLength: 6 }],
  ["ь", { bits: 0b10_0110, bitLength: 6 }],
  ["г", { bits: 0b10_0111, bitLength: 6 }],
  ["з", { bits: 0b10_1000, bitLength: 6 }],
  ["б", { bits: 0b10_1001, bitLength: 6 }],
  ["ч", { bits: 0b10_1010, bitLength: 6 }],
  ["й", { bits: 0b10_1011, bitLength: 6 }],
  ["ж", { bits: 0b10_1100, bitLength: 6 }],
  ["х", { bits: 0b10_1101, bitLength: 6 }],
  ["ш", { bits: 0b10_1110, bitLength: 6 }],
  ["ю", { bits: 0b10_1111, bitLength: 6 }],

  // префикс 11: 9 бит (fallback — индекс в полном алфавите)
  ["А", { bits: 0b11_0000000, bitLength: 9 }],
  ["Б", { bits: 0b11_0000001, bitLength: 9 }],
  ["В", { bits: 0b11_0000010, bitLength: 9 }],
  ["Г", { bits: 0b11_0000011, bitLength: 9 }],
  ["Д", { bits: 0b11_0000100, bitLength: 9 }],
  ["Е", { bits: 0b11_0000101, bitLength: 9 }],
  ["Ё", { bits: 0b11_0000110, bitLength: 9 }],
  ["Ж", { bits: 0b11_0000111, bitLength: 9 }],
  ["З", { bits: 0b11_0001000, bitLength: 9 }],
  ["И", { bits: 0b11_0001001, bitLength: 9 }],
  ["Й", { bits: 0b11_0001010, bitLength: 9 }],
  ["К", { bits: 0b11_0001011, bitLength: 9 }],
  ["Л", { bits: 0b11_0001100, bitLength: 9 }],
  ["М", { bits: 0b11_0001101, bitLength: 9 }],
  ["Н", { bits: 0b11_0001110, bitLength: 9 }],
  ["О", { bits: 0b11_0001111, bitLength: 9 }],
  ["П", { bits: 0b11_0010000, bitLength: 9 }],
  ["Р", { bits: 0b11_0010001, bitLength: 9 }],
  ["С", { bits: 0b11_0010010, bitLength: 9 }],
  ["Т", { bits: 0b11_0010011, bitLength: 9 }],
  ["У", { bits: 0b11_0010100, bitLength: 9 }],
  ["Ф", { bits: 0b11_0010101, bitLength: 9 }],
  ["Х", { bits: 0b11_0010110, bitLength: 9 }],
  ["Ц", { bits: 0b11_0010111, bitLength: 9 }],
  ["Ч", { bits: 0b11_0011000, bitLength: 9 }],
  ["Ш", { bits: 0b11_0011001, bitLength: 9 }],
  ["Щ", { bits: 0b11_0011010, bitLength: 9 }],
  ["Ъ", { bits: 0b11_0011011, bitLength: 9 }],
  ["Ы", { bits: 0b11_0011100, bitLength: 9 }],
  ["Ь", { bits: 0b11_0011101, bitLength: 9 }],
  ["Э", { bits: 0b11_0011110, bitLength: 9 }],
  ["Ю", { bits: 0b11_0011111, bitLength: 9 }],
  ["Я", { bits: 0b11_0100000, bitLength: 9 }],
  ["ё", { bits: 0b11_0100111, bitLength: 9 }],
  ["ф", { bits: 0b11_0110110, bitLength: 9 }],
  ["ц", { bits: 0b11_0111000, bitLength: 9 }],
  ["щ", { bits: 0b11_0111011, bitLength: 9 }],
  ["ъ", { bits: 0b11_0111100, bitLength: 9 }],
  ["э", { bits: 0b11_0111111, bitLength: 9 }],
  ["0", { bits: 0b11_1000010, bitLength: 9 }],
  ["1", { bits: 0b11_1000011, bitLength: 9 }],
  ["2", { bits: 0b11_1000100, bitLength: 9 }],
  ["3", { bits: 0b11_1000101, bitLength: 9 }],
  ["4", { bits: 0b11_1000110, bitLength: 9 }],
  ["5", { bits: 0b11_1000111, bitLength: 9 }],
  ["6", { bits: 0b11_1001000, bitLength: 9 }],
  ["7", { bits: 0b11_1001001, bitLength: 9 }],
  ["8", { bits: 0b11_1001010, bitLength: 9 }],
  ["9", { bits: 0b11_1001011, bitLength: 9 }],
  [".", { bits: 0b11_1001100, bitLength: 9 }],
  [",", { bits: 0b11_1001101, bitLength: 9 }],
  ["!", { bits: 0b11_1001110, bitLength: 9 }],
  ["?", { bits: 0b11_1001111, bitLength: 9 }],
  [":", { bits: 0b11_1010000, bitLength: 9 }],
  [";", { bits: 0b11_1010001, bitLength: 9 }],
  ["-", { bits: 0b11_1010010, bitLength: 9 }],
  ["'", { bits: 0b11_1010011, bitLength: 9 }],
  ['"', { bits: 0b11_1010100, bitLength: 9 }],
  ["(", { bits: 0b11_1010101, bitLength: 9 }],
  [")", { bits: 0b11_1010110, bitLength: 9 }],
  ["[", { bits: 0b11_1010111, bitLength: 9 }],
  ["]", { bits: 0b11_1011000, bitLength: 9 }],
  ["/", { bits: 0b11_1011001, bitLength: 9 }],
  ["@", { bits: 0b11_1011010, bitLength: 9 }],
  ["#", { bits: 0b11_1011011, bitLength: 9 }],
  ["$", { bits: 0b11_1011100, bitLength: 9 }],
  ["%", { bits: 0b11_1011101, bitLength: 9 }],
  ["&", { bits: 0b11_1011110, bitLength: 9 }],
  ["*", { bits: 0b11_1011111, bitLength: 9 }],
  ["+", { bits: 0b11_1100000, bitLength: 9 }],
  ["=", { bits: 0b11_1100001, bitLength: 9 }],
  ["<", { bits: 0b11_1100010, bitLength: 9 }],
  [">", { bits: 0b11_1100011, bitLength: 9 }],
  ["_", { bits: 0b11_1100100, bitLength: 9 }],
  ["|", { bits: 0b11_1100101, bitLength: 9 }],
  ["\t", { bits: 0b11_1100111, bitLength: 9 }],
  ["\n", { bits: 0b11_1101000, bitLength: 9 }],
]);

// упаковывает пару (bits, bitLength) в одно число для использования как ключ Map
function decodeKey(bits: number, bitLength: number): number {
  return (bitLength << 16) | bits;
}

// код → символ (обратная таблица)
const DECODE_TABLE = new Map<number, string>(
  [...ENCODE_TABLE].map(([symbol, { bits, bitLength }]) => [
    decodeKey(bits, bitLength),
    symbol,
  ]),
);

// префикс → сколько бит занимает индекс после него
const PREFIX_BIT_LENGTH = 2;
const PREFIX_TO_INDEX_BIT_LENGTH = new Map<number, number>([
  [0b00, 2],
  [0b01, 3],
  [0b10, 4],
  [0b11, 7],
]);

export class VariableTextEncoder {
  encode(text: string): EncodedText {
    const encodedSymbols = [...text].map((symbol) => {
      const code = ENCODE_TABLE.get(symbol);

      if (code === undefined) {
        throw new Error(
          `Символ ${JSON.stringify(symbol)} не поддерживается схемой кодирования`,
        );
      }

      return code;
    });

    const bitLength = encodedSymbols.reduce((sum, s) => sum + s.bitLength, 0);
    const stream = BitStream.forWrite(bitLength);

    for (const { bits, bitLength } of encodedSymbols) {
      stream.writeBits(bits, bitLength);
    }

    return {
      bytes: stream.toUint8Array(),
      bitLength,
    };
  }

  decode(encoded: EncodedText): string {
    const stream = BitStream.forRead(encoded.bytes, encoded.bitLength);
    let result = "";

    while (stream.hasMoreBits()) {
      const prefix = stream.readBits(PREFIX_BIT_LENGTH);
      const indexBitLength = PREFIX_TO_INDEX_BIT_LENGTH.get(prefix);

      if (indexBitLength === undefined) {
        throw new Error(`Неизвестный префикс: ${prefix}`);
      }

      const packed = stream.readWithPrefix(
        prefix,
        PREFIX_BIT_LENGTH,
        indexBitLength,
      );
      const symbol = DECODE_TABLE.get(decodeKey(packed.bits, packed.bitLength));

      if (symbol === undefined) {
        throw new Error(
          `Неизвестный код: bits=${packed.bits}, bitLength=${packed.bitLength}`,
        );
      }

      result += symbol;
    }

    return result;
  }
}
