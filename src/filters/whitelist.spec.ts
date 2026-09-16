import { suite, test } from "@testdeck/mocha";
import { defaultModules } from "../index.js";
import { SmtpServer } from "../server.js";
import { SmtpTest } from "../server.spec.js";
import { WhitelistFilter } from "./whitelist.js";
import { MemoryLogger, WorkerOutput } from "@webda/workout";
import * as assert from "assert";

@suite
class WhitelistSmtpServerTest {
  @test
  async whitelistOnSmtp() {
    defaultModules();
    let server = new SmtpServer("./tests/whitelist.json");
    server.init();
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "dest@smtp-relay.com", "Coucouc");
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "recipient2@domain1.com", "Coucouc");
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "recipient2@domain2.comz", "Coucouc");
    await new SmtpTest().failEmail("MAIL", "test@smtp-relay.com2", "recipient@domain1.com", "Coucouc");
    await new SmtpTest().sendEmail("test@smtp-relay.com", "recipient@domain1.com", "Coucouc");
    await new SmtpTest().sendEmail("test@smtp-relay.com", "recipient2@domain2.com", "Coucouc");
    server.close();
  }

  @test
  async whitelistOnIps() {
    defaultModules();
    let server = new SmtpServer("./tests/whitelist-ips.json");
    server.init();
    await new SmtpTest().sendEmail("test@smtp-relay.com", "dest@smtp-relay.com", "Coucouc");
    console.log("CLOSING SERVER");
    server.close();
  }

  @test
  async getRegExpPassthroughRegExp() {
    let output = new WorkerOutput();
    const filter = new WhitelistFilter(
      undefined as any,
      {
        type: "whitelist"
      },
      output
    );
    const reg = /^test$/;
    assert.strictEqual(filter.getRegExp(reg), reg);
  }

  @test
  async whitelistSubnet() {
    let output = new WorkerOutput();
    let logger = new MemoryLogger(output);
    const filter = new WhitelistFilter(
      undefined as any,
      {
        type: "whitelist",
        subnets: ["10.0.0.0/8", "127.0.0.1/32"]
      },
      output
    );
    assert.strictEqual(
      await filter.onConnect(<any>{
        remoteAddress: "10.1.1.1"
      }),
      true
    );
    assert.strictEqual(
      await filter.onConnect(<any>{
        remoteAddress: "11.1.1.1"
      }),
      false
    );
    assert.strictEqual(
      await filter.onConnect(<any>{
        remoteAddress: "127.0.0.1"
      }),
      true
    );
    assert.strictEqual(
      await filter.onConnect(<any>{
        remoteAddress: "127.0.0.2"
      }),
      false
    );
  }

  @test
  async whitelistSubnetCombinedWithIps() {
    let output = new WorkerOutput();
    const filter = new WhitelistFilter(
      undefined as any,
      {
        type: "whitelist",
        subnets: ["10.0.0.0/8"],
        ips: ["192.168.0.1"]
      },
      output
    );
    // Matched by the `ips` list: the subnet checker must not override the decision
    assert.strictEqual(await filter.onConnect(<any>{ remoteAddress: "192.168.0.1" }), true);
    // Not in `ips` but inside a whitelisted subnet
    assert.strictEqual(await filter.onConnect(<any>{ remoteAddress: "10.1.1.1" }), true);
    // Neither in `ips` nor in a whitelisted subnet
    assert.strictEqual(await filter.onConnect(<any>{ remoteAddress: "11.1.1.1" }), false);
  }

  @test
  async getRegExpInvalidRegex() {
    let output = new WorkerOutput();
    const filter = new WhitelistFilter(
      undefined as any,
      {
        type: "whitelist"
      },
      output
    );
    assert.throws(() => filter.getRegExp("regexp:[invalid"), /Invalid regex pattern in whitelist filter/);
  }
}
