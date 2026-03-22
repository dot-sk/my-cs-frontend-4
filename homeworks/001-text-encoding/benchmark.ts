import { FixedTextEncoder } from "./fixed-encoding.ts";
import { VariableTextEncoder } from "./text-encoding.ts";

// Отрывок из "Евгения Онегина" А.С. Пушкина (строфы 1-3)
const TEXT = `Мой дядя самых честных правил,
Когда не в шутку занемог,
Он уважать себя заставил
И лучше выдумать не мог.
Его пример другим наука;
Но, Боже мой, какая скука
С больным сидеть и день и ночь,
Не отходя ни шагу прочь!
Какое низкое коварство
Полуживого забавлять,
Ему подушки поправлять,
Печально подносить лекарство,
Вздыхать и думать про себя:
Когда же черт возьмет тебя!

Так думал молодой повеса,
Летя в пыли на почтовых,
Всевышней волею Зевеса
Наследник всех своих родных.
Друзья Людмилы и Руслана!
С героем моего романа
Без предисловий, сей же час
Позвольте познакомить вас:
Онегин, добрый мой приятель,
Родился на брегах Невы,
Где, может быть, родились вы
Или блистали, мой читатель;
Там некогда гулял и я:
Но вреден север для меня.`;

const charCount = [...TEXT].length;

const fixedEncoder = new FixedTextEncoder();
const variableEncoder = new VariableTextEncoder();

// UTF-8 это по сути тот же подход что и вариант 2: переменная длина кодов с префиксами
// Только UTF-8 оптимизирован под английский (1 байт на ASCII, 2 на кириллицу, 3-4 на остальное),
// а вариант 2 оптимизирован под русский (4 бита на частые русские буквы)
const utf8Bytes = new TextEncoder().encode(TEXT).byteLength;
// Windows-1251 это по сути тот же подход что и вариант 1: фиксированный 1 байт на символ
// Только в Win-1251 таблица стандартная (0-127 ASCII, 128-255 кириллица),
// а в варианте 1 мы сами нарезали страницы через битовые префиксы
// Результат одинаковый: 8 бит на символ, без сжатия
const win1251Bytes = charCount;

const fixedEncoded = fixedEncoder.encode(TEXT);
const variableEncoded = variableEncoder.encode(TEXT);

const rows = [
  { name: "UTF-8", bytes: utf8Bytes },
  { name: "Windows-1251", bytes: win1251Bytes },
  {
    name: "Фикс. 8 бит (вар. 1)",
    bytes: fixedEncoded.bytes.byteLength,
    bits: fixedEncoded.bitLength,
  },
  {
    name: "Перем. коды (вар. 2)",
    bytes: variableEncoded.bytes.byteLength,
    bits: variableEncoded.bitLength,
  },
];

console.log(`Текст: "${TEXT.slice(0, 80)}..."`);
console.log(`Символов: ${charCount}\n`);

console.log("Кодировка             | Байт  | Бит/символ | vs UTF-8");
console.log("----------------------|-------|------------|--------");

for (const row of rows) {
  const bits = row.bits ?? row.bytes * 8;
  const bitsPerChar = (bits / charCount).toFixed(2);
  const savings = (((utf8Bytes - row.bytes) / utf8Bytes) * 100).toFixed(1);
  const sign = Number(savings) >= 0 ? "-" : "+";

  console.log(
    `${row.name.padEnd(22)}| ${String(row.bytes).padStart(5)} | ${bitsPerChar.padStart(10)} | ${sign}${Math.abs(Number(savings)).toFixed(1)}%`,
  );
}
