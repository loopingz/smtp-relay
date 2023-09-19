import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import * as http from "http";
import { defaultModules } from "..";
import { SmtpFlow } from "../flow";
import { SmtpServer } from "../server";
import { SmtpTest } from "../server.spec";
import { HttpFilter } from "./http-filter";
import { SmtpCloudEvent } from "../cloudevent";

@suite
class HttpSmtpServerTest extends SmtpTest {
  server;
  jsonpath: boolean = false;
  smtpServer: SmtpServer;

  before() {
    this.server = http
      .createServer((req, res) => {
        let body = "";
        req.on("data", chunk => {
          body += chunk;
        });
        req.on("end", () => {
          body = body.trim();
          if (req.headers["content-type"] === "application/json") {
            let info: SmtpCloudEvent = JSON.parse(body).data;
            if (
              info.email.from.value[0].address === "test@smtp-relay.com" &&
              info.email.to.find(a => a.value[0].address === "recipient@domain1.com")
            ) {
              res.write("OK");
            } else if (
              info.email.from.value[0].address === "test@smtp-relay.com" &&
              info.email.to.find(a => a.value[0].address === "recipient@domain1.com") &&
              info.server.username === "authenticated"
            ) {
              res.write("OK");
            } else {
              res.writeHead(401);
            }
          } else {
            res.writeHead(401);
          }
          res.end();
        });
      })
      .listen(16662);
  }

  after() {
    this.server.close();
    super.after();
  }

  @test
  async withoutAuth() {
    defaultModules();
    let server = (this.smtpServer = new SmtpServer("./tests/http-filter.json"));
    server.init();
    await new SmtpTest().sendEmail("test@smtp-relay.com", "recipient@domain1.com", "Coucouc");
    await new SmtpTest().failEmail("DATA", "test@smtp-relay.com", "recipient@domain2.com", "Coucouc");
  }

  @test
  cov() {
    const logger = new WorkerOutput();
    const flow = new SmtpFlow("test", { outputs: [] }, logger);
    let filter: HttpFilter;
    assert.throws(() => new HttpFilter(flow, <any>{ type: "http-filter" }, logger), /http-auth filter requires an url/);
  }

  @test
  async testAuth() {
    defaultModules();
    let server = (this.smtpServer = new SmtpServer("./tests/http-filter-with-auth.json"));
    server.init();
    let test = new SmtpTest();
    let p1 = test.waitFor("220");
    await test.connect();
    test.output = "";
    test.sock.on("data", data => {
      console.log("Received:", data.toString());
      test.output += data + "\n";
      if (data.toString().substr(0, 3) === test.waitCode) {
        let p = test.waitForPromise;
        test.waitForPromise = null;
        p();
      }
    });
    await p1;
    await test.write(`HELO test.com`, "250");
    await test.write(`AUTH LOGIN`, "334");
    await test.write(`dGVzdA==`, "334");
    await test.write(`dGVzdA==`, "235");
    await test.write("MAIL FROM: <test@smtp-relay.com>", "250");
    await test.write("RCPT TO: <recipient@domain2.com>", "250");
    await test.write("DATA", "354");
    await test.write("Coucou\r\n.\r\n", "450");

    server.close();
  }

  @test
  async testAuthGood() {
    defaultModules();
    let server = (this.smtpServer = new SmtpServer("./tests/http-filter-with-auth.json"));
    server.init();
    let test = new SmtpTest();
    let p1 = test.waitFor("220");
    await test.connect();
    test.output = "";
    test.sock.on("data", data => {
      console.log("Received:", data.toString());
      test.output += data + "\n";
      if (data.toString().substr(0, 3) === test.waitCode) {
        let p = test.waitForPromise;
        test.waitForPromise = null;
        p();
      }
    });
    await p1;
    await test.write(`HELO test.com`, "250");
    // Use authenticated user for this one now
    await test.write(`AUTH LOGIN`, "334");
    await test.write(`YXV0aGVudGljYXRlZA==`, "334");
    await test.write(`dGVzdA==`, "235");
    await test.write("MAIL FROM: <test@smtp-relay.com>", "250");
    await test.write("RCPT TO: <recipient@domain1.com>", "250");
    await test.write("RCPT TO: <recipient@domain2.com>", "250");

    await test.write("DATA", "354");
    await test.write("Coucou\r\n.\r\n", "250");
  }
}
