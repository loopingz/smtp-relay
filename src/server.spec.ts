import { suite, test } from "@testdeck/mocha";
import { Socket } from "net";
import { SmtpServer } from "./server";
import { SmtpFilter } from "./filter";
import { SmtpFlow } from "./flow";
import * as assert from "assert";
import { defaultModules } from ".";

export class SmtpTest {
  sock: Socket;
  output: string;
  waitForPromise: () => void;
  waitCode: string;

  async write(data, nextCode = undefined) {
    return new Promise<void>(resolve => {
      console.log("Sending:", data);
      if (!data.endsWith("\n")) {
        data += "\n";
      }
      if (nextCode) {
        this.waitCode = nextCode;
        this.waitForPromise = resolve;
        this.sock.write(data, "utf8");
        return;
      }
      this.sock.write(data, "utf8", () => {
        resolve();
      });
    });
  }

  async waitFor(code) {
    this.waitCode = code;
    return new Promise<void>(resolve => {
      this.waitForPromise = resolve;
    });
  }

  async connect(port: number = 10025) {
    return new Promise<void>(resolve => {
      this.sock.connect(port, "localhost", resolve);
    });
  }

  async sendEmail(from: string, to: string, msgData: string, port: number = 10025) {
    return new Promise<string>(async (resolve, reject) => {
      this.sock = new Socket();
      this.output = "";
      this.sock.on("data", data => {
        console.log("Received:", data.toString());
        this.output += data + "\n";
        if (data.toString().substr(0, 3) === this.waitCode) {
          let p = this.waitForPromise;
          this.waitForPromise = null;
          p();
        }
      });
      this.sock.on("end", () => resolve(this.output));
      let p = this.waitFor("220");
      await this.connect();
      await p;
      await this.write(`HELO test.com`, "250");
      await this.write(`MAIL FROM: <${from}>`, "250");
      await this.write(`RCPT TO: <${to}>`, "250");
      await this.write(`DATA`, "354");
      await this.write(`${msgData}\r\n\r\n.\r\n`, "250");
      await this.write(`QUIT`, "221");
      this.sock.end();
    });
  }

  async failEmail(
    step: "CONNECT" | "HELO" | "MAIL" | "RCPT" | "DATA",
    from: string,
    to: string,
    msgData: string,
    port: number = 10025
  ) {
    return new Promise<string>(async (resolve, reject) => {
      this.sock = new Socket();
      this.output = "";
      this.sock.on("data", data => {
        console.log("Received:", data.toString());
        this.output += data + "\n";
        if (data.toString().substr(0, 3) === this.waitCode) {
          let p = this.waitForPromise;
          this.waitForPromise = null;
          p();
        }
      });
      this.sock.on("end", () => resolve(this.output));
      try {
        let p = this.waitFor(step === "CONNECT" ? "550" : "220");
        await this.connect();
        await p;
        await this.write(`HELO test.com`, step === "HELO" ? "550" : "250");
        if (step === "HELO") {
          return;
        }
        await this.write(`MAIL FROM: <${from}>`, step === "MAIL" ? "550" : "250");
        if (step === "MAIL") {
          return;
        }
        await this.write(`RCPT TO: <${to}>`, step === "RCPT" ? "550" : "250");
        if (step === "RCPT") {
          return;
        }
        await this.write(`DATA`, step === "DATA" ? "550" : "354");
        if (step === "DATA") {
          return;
        }
        await this.write(`${msgData}\r\n\r\n.\r\n`, "250");
        await this.write(`QUIT`, "221");
      } finally {
        this.sock.end();
      }
    });
  }
}

class CountFilter extends SmtpFilter {
  type: string = "count";
  stats: { [key: string]: number };
  constructor(flow: SmtpFlow) {
    super(flow, {
      name: "",
      type: "count"
    });
    this.stats = {};
    ["Connect", "Data", "RcptTo", "MailFrom", "Auth"].forEach(m => {
      m = `on${m}`;
      this.stats[m] = 0;
      this[m] = async (...args) => {
        this.stats[m]++;
        return undefined;
      };
    });
  }
}

class OpenFilter extends SmtpFilter {
  type: string = "allow";

  async onRcptTo(address, session): Promise<true> {
    return true;
  }
}

@suite
class SmtpServerTest {
  @test
  async middlewareChaining() {
    defaultModules();
    SmtpFilter.register("count", CountFilter);
    SmtpFilter.register("open", OpenFilter);
    let server = new SmtpServer("./tests/count.json");
    server.init();
    await new SmtpTest().sendEmail("test@smtp-relay.com", "dest@smtp-relay.com", "Coucouc");
    assert.deepStrictEqual(
      server.flows.localhost.filters.filter(f => f.config.type === "count").map(f => (<CountFilter>f).stats),
      [
        { onAuth: 0, onConnect: 1, onMailFrom: 1, onRcptTo: 1, onData: 1 },
        { onAuth: 0, onConnect: 1, onMailFrom: 1, onRcptTo: 1, onData: 1 }
      ]
    );
    server.close();
    // cov
    // @ts-ignore
    server.addFlow({ name: "Test" });
    // @ts-ignore
    server.removeFlow({ name: "Test" });
  }

  @test
  replaceVars() {
    assert.ok(SmtpServer.replaceVariables("${timestamp}", {}).match(/\d+/) !== undefined);
    console.log(SmtpServer.replaceVariables("${iso8601}"));
  }

  @test
  defaultConf() {
    assert.throws(() => new SmtpServer(), /Configuration '.\/smtp-relay.json' not found/);
  }

  @test
  async filtersOperatorOR() {
    defaultModules();
    let server = new SmtpServer("./tests/whitelist-or.json");
    server.init();
    await new SmtpTest().sendEmail("test@smtp-relay.com", "recipient@domain1.com", "Coucouc");
    await new SmtpTest().sendEmail("test@smtp-relay.com", "recipient@domain2.com", "Coucouc");
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "recipient@domain3.com", "Coucouc");
    server.close();
  }

  @test
  async filtersOperatorAND() {
    defaultModules();
    let server = new SmtpServer("./tests/whitelist-and.json");
    server.init();
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "recipient@domain1.com", "Coucouc");
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "recipient@domain2.com", "Coucouc");
    await new SmtpTest().failEmail("RCPT", "test@smtp-relay.com", "recipient@domain3.com", "Coucouc");
    server.close();
  }
}
