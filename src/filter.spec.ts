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
    assert.strictEqual(await test.onAuth(undefined as any, undefined as any), undefined);
    assert.strictEqual(await test.onMailFrom(undefined as any, undefined as any), undefined);
    assert.strictEqual(await test.onRcptTo(undefined as any, undefined as any), undefined);
    assert.strictEqual(await test.onData(undefined as any), undefined);
    // @ts-ignore
    let obj: SmtpSession = {} as any;

    test.setState(obj, { test: true });
    assert.deepStrictEqual((obj as any)["Flow_Test"], { test: true });
    assert.deepStrictEqual(test.getState(obj), { test: true });

    assert.throws(() => SmtpFilter.get(null as any, { type: "unknown-filter" }), /unknown-filter/);
  }
}
