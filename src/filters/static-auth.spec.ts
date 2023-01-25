import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { SmtpFlow } from "../flow";
import { StaticAuthFilter } from "./static-auth";

@suite
class StaticSmtpServerTest {
  @test
  async cov() {
    const logger = new WorkerOutput();
    const flow = new SmtpFlow("test", { outputs: [] }, logger);
    let filter: StaticAuthFilter;
    assert.throws(() => new StaticAuthFilter(flow, { type: "static-auth" }, logger), /requires to have authentication/);
    process.env.SMTP_USERNAME = "test";
    assert.throws(() => new StaticAuthFilter(flow, { type: "static-auth" }, logger), /requires to have authentication/);
    process.env.SMTP_PASSWORD = "test";
    assert.throws(() => new StaticAuthFilter(flow, { type: "static-auth" }, logger), /do not recognize hash/);
    process.env.SMTP_PASSWORD = "plain:test";
    filter = new StaticAuthFilter(flow, { type: "static-auth" }, logger);
    assert.ok(!(await filter.onAuth({ method: "LOGIN", validatePassword: () => false })));
    assert.ok(
      !(await filter.onAuth({ method: "LOGIN", username: "test", password: "plop", validatePassword: () => false }))
    );
    assert.ok(
      await filter.onAuth({ method: "LOGIN", username: "test", password: "test", validatePassword: () => false })
    );
    filter.config.password = "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    assert.ok(
      await filter.onAuth({ method: "LOGIN", username: "test", password: "test", validatePassword: () => false })
    );
    process.env.SMTP_PASSWORD_SALT = "test";
    filter.init();
    filter.config.password = "sha256:88cd2108b5347d973cf39cdf9053d7dd42704876d8c9a9bd8e2d168259d3ddf7";
    assert.ok(
      await filter.onAuth({ method: "LOGIN", username: "test", password: "test", validatePassword: () => false })
    );
  }
}
