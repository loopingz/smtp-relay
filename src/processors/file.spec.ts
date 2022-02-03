import { suite, test } from "@testdeck/mocha";
import * as assert from "assert";
import { FileProcessor } from "./file";

@suite
class FileProcessorTest {
  @test
  async cov() {
    // @ts-ignore
    assert.throws(() => new FileProcessor(undefined, { filename: "plop" }), /Need to specify a path/);
  }
}
