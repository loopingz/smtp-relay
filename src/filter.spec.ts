import { suite, test } from "@testdeck/mocha";
import * as assert from "assert";
import { SmtpFilter } from "./filter";
import { SmtpSession } from "./server";

@suite
class FilterTest {
  @test
  async cov() {
    // @ts-ignore
    let test = new SmtpFilter({ name: "Flow" }, { name: "Test" });
    assert.strictEqual(await test.onAuth(undefined, undefined), undefined);
    assert.strictEqual(await test.onMailFrom(undefined, undefined), undefined);
    assert.strictEqual(await test.onRcptTo(undefined, undefined), undefined);
    assert.strictEqual(await test.onData(undefined), undefined);
    // @ts-ignore
    let obj: SmtpSession = {};

    test.setState(obj, { test: true });
    assert.deepStrictEqual(obj["Flow_Test"], { test: true });
    assert.deepStrictEqual(test.getState(obj), { test: true });

    assert.throws(() => SmtpFilter.get(null, { type: "unknown-filter" }), /unknown-filter/);
  }
}
