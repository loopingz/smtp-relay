import { Transform, TransformOptions } from "node:stream";

/**
 * Configuration for mail headers
 *
 * If key is prefixed with a - then the header is removed
 * If key is prefixed with a ? then the header is added only if not present
 */
export type HeadersTransformConfig = {
  [key: string]: string;
};

/**
 * Inject or remove headers from a DATA stream
 */
export class HeadersTransform extends Transform {
  previousChunk = "";
  headersDone = false;
  headersToRemove: string[] = [];
  headersToUpsert: Set<string>;

  constructor(
    protected headers: HeadersTransformConfig,
    options?: TransformOptions
  ) {
    super(options);
    this.headersToRemove = Object.keys(headers)
      .filter(key => key.startsWith("-"))
      .map(key => key.substring(1));
    this.headersToUpsert = new Set(
      Object.keys(headers)
        .filter(key => key.startsWith("?"))
        .map(key => key.substring(1))
    );
  }

  /**
   * Check if the header should be included and also remember headers seen
   *
   * @param line
   * @returns
   */
  includeHeader(line: string): boolean {
    const header = line.split(":")[0];
    // Found header no need to add
    this.headersToUpsert.delete(header);
    if (this.headersToRemove.includes(header)) {
      return false;
    }
    return true;
  }

  /**
   * Add headers to the stream
   */
  addHeaders() {
    for (let key in this.headers) {
      if (key.startsWith("-")) {
        continue;
      }
      if (key.startsWith("?")) {
        if (this.headersToUpsert.has(key.substring(1))) {
          this.push(`${key.substring(1)}: ${this.headers[key]}\n`);
        }
        continue;
      }
      this.push(`${key}: ${this.headers[key]}\n`);
    }
  }

  /**
   * Override
   * @param chunk
   * @param encoding
   * @param callback
   * @returns
   */
  _transform(chunk, encoding, callback) {
    // Do not filter headers if headers are already done
    if (this.headersDone) {
      this.push(chunk);
      callback();
      return;
    }
    const currentChunk = this.previousChunk + chunk.toString();
    const lines = currentChunk.split("\n");
    // Check if the headers are done
    this.headersDone = currentChunk.includes("\n\n");
    // We found an empty line, headers are done
    if (this.headersDone) {
      const headersEnd = lines.findIndex(line => line === "");
      // We filter the remaining headers
      this.push(
        lines
          .slice(0, headersEnd)
          .filter(line => this.includeHeader(line))
          .join("\n") + "\n"
      );
      this.addHeaders();
      this.push(lines.slice(headersEnd).join("\n"));
      callback();
      return;
    }

    // Check if the last line is complete
    if (currentChunk.endsWith("\n")) {
      this.previousChunk = "";
    } else {
      this.previousChunk = lines.pop();
    }
    const filteredLines = lines.filter(line => this.includeHeader(line));
    this.push(filteredLines.join("\n"));
    callback();
  }
}
