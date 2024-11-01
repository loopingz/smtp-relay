import { suite, test } from "@testdeck/mocha";
import * as assert from "assert";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { createReadStream } from "node:fs";
import { HeadersTransform } from "./headers_transformer";

class BufferWritable extends Writable {
  buffer: Buffer;

  constructor(options?) {
    super(options);
    this.buffer = Buffer.alloc(0); // Initialize an empty buffer
  }

  _write(chunk, encoding, callback) {
    // Concatenate the incoming chunk to the buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);
    callback();
  }

  toString() {
    return this.buffer.toString();
  }
}

@suite
class HeadersTransformerTest {
  TEST_FILE = import.meta.dirname + "/../tests/data-headers.txt";

  @test
  async normal() {
    await this.test(createReadStream(this.TEST_FILE));
  }
  @test
  async chunked() {
    await this.test(createReadStream(this.TEST_FILE, { highWaterMark: 4 }));
  }

  async test(readable: NodeJS.ReadableStream) {
    const writable = new BufferWritable();
    await pipeline(
      readable,
      new HeadersTransform({ "-X-Test": "", "X-Received": "Add", "?X-Upsert-1": "Value", "?X-Upsert-2": "Value2" }),
      writable
    );
    const wr = writable.toString();

    assert.ok(!wr.includes("X-Test: plop"), "Should remove X-Test");
    assert.ok(wr.includes("X-Received: whatever"), "Should keep X-Received");
    assert.ok(wr.includes("X-Received: Add"), "Should add X-Received");
    assert.ok(wr.includes("X-Upsert-2: Value2"), "Should upsert X-Upsert-2");
    assert.ok(!wr.includes("X-Upsert-1: Value"), "Should not upsert X-Upsert-1");
    assert.ok(wr.includes("X-Upsert-1: test"), "Should keep X-Upsert-1");
    assert.ok(wr.includes("X-Test: still here"), "Should keep X-Test");
  }
}
