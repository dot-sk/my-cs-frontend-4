import { describe, expect, it } from "bun:test";
import path from "path";

import { CsvParser } from "./008-csv-parser";

describe("008-csv-parser", () => {
  it("парсит CSV с запятой", async () => {
    const csv = `name,age,city
John,30,New York
Jane,25,Los Angeles`;

    const parser = new CsvParser();
    const result = await parser.fromString(csv);

    expect(result).toEqual([
      ["name", "age", "city"],
      ["John", "30", "New York"],
      ["Jane", "25", "Los Angeles"],
    ]);
  });

  it("парсит CSV с точкой с запятой", async () => {
    const csv = `name;age;city
John;30;New York
Jane;25;Los Angeles`;

    const parser = new CsvParser();
    const result = await parser.fromString(csv, ";");

    expect(result).toEqual([
      ["name", "age", "city"],
      ["John", "30", "New York"],
      ["Jane", "25", "Los Angeles"],
    ]);
  });

  it("парсит CSV с кавычками и запятыми внутри полей", async () => {
    const csv = `name,age,city
"John, Doe",30,"New York, NY"
"Jane Smith",25,"Los Angeles, CA"`;

    const parser = new CsvParser();
    const result = await parser.fromString(csv);

    expect(result).toEqual([
      ["name", "age", "city"],
      ["John, Doe", "30", "New York, NY"],
      ["Jane Smith", "25", "Los Angeles, CA"],
    ]);
  });

  it("парсит CSV с переносами строк внутри кавычек", async () => {
    const csv = `name,age,city
"John Doe",30,"New York
NY"
"Jane Smith",25,"Los Angeles
CA"`;

    const parser = new CsvParser();
    const result = await parser.fromString(csv);

    expect(result).toEqual([
      ["name", "age", "city"],
      ["John Doe", "30", "New York\nNY"],
      ["Jane Smith", "25", "Los Angeles\nCA"],
    ]);
  });

  it("кадает ошибку при битых данных", async () => {
    const csv = `name,age,city
John,30,New York
Jane,25,"Los Angeles`;

    const parser = new CsvParser();

    await expect(parser.fromString(csv)).rejects.toThrow();
  });

  it("парсит CSV из файла", async () => {
    const testFilePath = "./fixtures/cases.csv";
    const parser = new CsvParser();
    const result = await parser.fromFile(
      path.resolve(import.meta.dir, testFilePath),
    );

    expect(result).toEqual([
      ["id", "name", "note"],
      ["1", "John", "просто"],
      ["2", "", "пустое имя"],
      ["3", "Jane Doe", "город, штат"],
      ["4", "несколько\nстрок", 'значение с "кавычками" внутри'],
      ["5", "trailing", ""],
      ["6", "last", "без перевода"],
    ]);
  });
});
