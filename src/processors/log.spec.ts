import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { HeaderValue } from "mailparser";
import * as sinon from "sinon";
import { SmtpSession } from "../server.js";
import { getFakeSession } from "../server.spec.js";
import { LogProcessor } from "./log.js";

@suite
class LogProcessorTest {
  @test
  async mailer() {
    let log = new LogProcessor(
      undefined as any,
      {
        type: "log"
      },
      new WorkerOutput()
    );

    let session: SmtpSession = getFakeSession();
    let msg;

    session.email!.to = [
      {
        html: "Html content",
        text: "Text content",
        value: [{ name: "Test", address: "test@plop.com" }]
      }
    ];
    session.email!.html = "Html content";
    session.email!.text = "Text content";
    session.email!.subject = "Subject";
    session.email!.from = {
      html: "Html content",
      text: "Text content",
      value: [{ name: "Test", address: "" }]
    };

    const headers = new Map<string, HeaderValue>();
    headers.set("plop", "test");
    // @ts-ignore
    session.email!.attachments.push({
      contentDisposition: "plop",
      headers
    });
    let calls: any[][] = [];
    let stub = sinon.stub(log.logger, "log").callsFake((...args: any[]) => {
      calls.push(args);
    });
    await log.onMail(session);
    stub.restore();
    msg = calls
      .map(c => c.splice(1).join(" "))
      .join("\n")
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/, "UTC_DATE");
    assert.strictEqual(
      msg,
      `Email received UTC_DATE from 127.0.0.1
--------------------------------------------------------------------------------
from: Text content
to: test@plop.com
subject: Subject
text: Text content
--------------------------------------------------------------------------------
`
    );
  }

  @test
  async fallsBackToConsoleWithoutLogger() {
    // No WorkerOutput provided: the processor must fall back to the global console
    const log = new LogProcessor(undefined as any, { type: "log" }, undefined as any);
    const session: SmtpSession = getFakeSession();
    session.email!.subject = "Subject";
    const calls: any[][] = [];
    const stub = sinon.stub(console, "log").callsFake((...args: any[]) => {
      calls.push(args);
    });
    try {
      await log.onMail(session);
    } finally {
      stub.restore();
    }
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], "INFO");
    assert.ok(calls[0][1].includes("subject: Subject"));
  }
}
