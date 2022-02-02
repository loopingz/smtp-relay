import { suite, test } from "@testdeck/mocha";
import { SmtpServer } from "../server";
import * as assert from "assert";
import { defaultModules } from "..";
import { SmtpTest } from "../server.spec";

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
    server.close();
  }
}
