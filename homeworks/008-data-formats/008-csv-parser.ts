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
     * 1. Читаем поток по чанкам
     * 2. Вместо обхода каждого символа используем indexOf – он реализован нативно,
     *    поэтому работает быстрее, чем за O(n)
     * 3. Стэйт машина с тремя состояниями:
     *    - unquoted: ищем ближайший спецсимвол и одним slice копируем
     *      в buffer данные от курсора до символа
     *    - inQuotes: внутри кавычек могут быть только данные, ищем только следующую кавычку
     *    - quoteInQuotes: решает один следующий символ (экранирование `""`
     *      или конец поля)
     */
    let state: "unquoted" | "inQuotes" | "quoteInQuotes" = "unquoted";
    let buffer = "";
    let data: string[] = [];

    const LINE_END = "\n";
    const SEP = separator;
    const QUOTE = '"';

    // Функция по типу indexOf, но возвращает s.length вместо -1,
    // чтобы было удобно использовать Math.min
    const findFrom = (s: string, substr: string, from: number) => {
      const i = s.indexOf(substr, from);
      return i === -1 ? s.length : i;
    };

    for await (const bytes of stream) {
      const chunk = decoder.decode(bytes, { stream: true });

      let cursor = 0;
      // Кэш позиций спецсимволов в текущем chunk:
      //   == chunk.length – в оставшейся части chunk символа нет
      //   >=cursor        – валидная позиция
      //   <cursor         – кэш устарел, refresh() пересчитает через findFrom
      const specials = {
        quote: findFrom(chunk, QUOTE, 0),
        sep: findFrom(chunk, SEP, 0),
        lf: findFrom(chunk, LINE_END, 0),
        refresh(from: number) {
          if (this.quote < from) this.quote = findFrom(chunk, QUOTE, from);
          if (this.sep < from) this.sep = findFrom(chunk, SEP, from);
          if (this.lf < from) this.lf = findFrom(chunk, LINE_END, from);
        },
      };

      while (cursor < chunk.length) {
        switch (state) {
          case "unquoted": {
            specials.refresh(cursor);
            const nextPos = Math.min(specials.quote, specials.sep, specials.lf);

            // Нет спецсимволов до конца chunk – все оставшееся данные поля
            if (nextPos === chunk.length) {
              buffer += chunk.slice(cursor);
              cursor = chunk.length;
              break;
            }

            buffer += chunk.slice(cursor, nextPos);

            if (nextPos === specials.quote) {
              state = "inQuotes";
            } else if (nextPos === specials.sep) {
              data.push(buffer);
              buffer = "";
            } else {
              // nextPos === specials.lf
              data.push(buffer);
              yield data;
              data = [];
              buffer = "";
            }
            cursor = nextPos + 1;
            break;
          }

          case "inQuotes": {
            // Внутри кавычек интересна только сама кавычка
            if (specials.quote < cursor) {
              specials.quote = findFrom(chunk, QUOTE, cursor);
            }

            if (specials.quote === chunk.length) {
              buffer += chunk.slice(cursor);
              cursor = chunk.length;
              break;
            }

            buffer += chunk.slice(cursor, specials.quote);
            state = "quoteInQuotes";
            cursor = specials.quote + 1;
            break;
          }

          case "quoteInQuotes": {
            // Решает ровно один следующий символ
            const char = chunk[cursor];
            if (char === QUOTE) {
              buffer += QUOTE;
              state = "inQuotes";
            } else if (char === SEP) {
              data.push(buffer);
              buffer = "";
              state = "unquoted";
            } else if (char === LINE_END) {
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
            cursor++;
            break;
          }

          default: {
            // TypeScript проверит exhaustiveness – если добавим новое состояние
            // и забудем case, тут будет compile error
            const _exhaustive: never = state;
            throw new Error(`Unknown state: ${_exhaustive}`);
          }
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
