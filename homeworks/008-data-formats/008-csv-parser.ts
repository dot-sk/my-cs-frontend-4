export class CsvParser {
  async fromFile(path: string, separator: string = ","): Promise<string[][]> {
    const stream = Bun.file(path).stream();
    const result: string[][] = [];

    for await (const line of this.readline(stream, separator)) {
      result.push(line);
    }

    return result;
  }

  async fromStream(
    stream: ReadableStream<Uint8Array>,
    separator: string = ",",
  ): Promise<string[][]> {
    const result: string[][] = [];

    for await (const line of this.readline(stream, separator)) {
      result.push(line);
    }

    return result;
  }

  async fromString(data: string, separator: string = ","): Promise<string[][]> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(data));
        controller.close();
      },
    });

    return this.fromStream(stream, separator);
  }

  async *readline(
    stream: ReadableStream<Uint8Array>,
    separator: string,
  ): AsyncGenerator<string[]> {
    const decoder = new TextDecoder();

    // пример данных (разделитель - запятая):
    // name,age,city
    // "John,Doe",30,"New York"\n
    // "Jane Smith",25,"Los Angeles"\n

    /**
     * Алгоритм:
     * 1. Читаем данные из потока по кускам (chunk)
     * 2. Декодируем байты в строку
     * 3. Проходим по каждому символу строки:
     *    - Если встречаем кавычку, переключаемся в режим "внутри кавычек"
     *    - Если встречаем разделитель и мы не внутри кавычек, то это конец поля
     *    - Если встречаем перенос строки и мы не внутри кавычек, то это конец записи
     * 4. Собираем поля в массив и возвращаем его как результат парсинга строки
     */
    let state: "unquoted" | "inQuotes" | "quoteInQuotes" = "unquoted";
    let buffer = "";
    let data: string[] = [];

    const lineEnd = "\n";

    for await (const bytes of stream) {
      const chunk = decoder.decode(bytes, { stream: true });

      for (const char of chunk) {
        switch (state) {
          case "unquoted":
            if (char === '"') {
              state = "inQuotes";
            } else if (char === separator) {
              data.push(buffer);

              buffer = "";
            } else if (char === lineEnd) {
              data.push(buffer);

              yield data;
              data = [];
              buffer = "";
            } else {
              buffer += char;
            }

            break;
          case "inQuotes":
            if (char === '"') {
              state = "quoteInQuotes";
            } else {
              buffer += char;
            }

            break;
          case "quoteInQuotes":
            if (char === '"') {
              buffer += '"';
              state = "inQuotes";
            } else if (char === separator) {
              data.push(buffer);
              buffer = "";
              state = "unquoted";
            } else if (char === lineEnd) {
              data.push(buffer);
              yield data;
              data = [];
              buffer = "";
              state = "unquoted";
            } else {
              throw new Error(
                "Некорректный CSV: неожиданный символ после закрывающей кавычки",
              );
            }
            break;
          default:
            throw new Error("UB");
        }
      }
    }

    // обрабатываем остаток данных после окончания потока
    if (state === "inQuotes") {
      throw new Error("Некорректный CSV: незакрытая кавычка");
    }

    if (buffer.length > 0) {
      data.push(buffer);
    }

    if (data.length > 0) {
      yield data;
    }
  }
}
