import { suite, test } from "@testdeck/mocha";
import { defaultModules } from "..";
import { SmtpServer } from "../server";
import { SmtpTest } from "../server.spec";
import { WhitelistFilter } from "./whitelist";
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
  async whitelistSubnet() {
    let output = new WorkerOutput();
    let logger = new MemoryLogger(output);
    const filter = new WhitelistFilter(
      undefined,
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
}
