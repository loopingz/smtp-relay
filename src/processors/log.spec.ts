import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { HeaderValue } from "mailparser";
import * as sinon from "sinon";
import { SmtpSession } from "../server";
import { getFakeSession } from "../server.spec";
import { LogProcessor } from "./log";

@suite
class LogProcessorTest {
  @test
  async mailer() {
    let log = new LogProcessor(
      undefined,
      {
        type: "log"
      },
      new WorkerOutput()
    );

    let session: SmtpSession = getFakeSession();
    let msg;

    session.email.to = [
      {
        html: "Html content",
        text: "Text content",
        value: [{ name: "Test", address: "test@plop.com" }]
      }
    ];
    session.email.html = "Html content";
    session.email.text = "Text content";
    session.email.subject = "Subject";
    session.email.from = {
      html: "Html content",
      text: "Text content",
      value: [{ name: "Test", address: "" }]
    };

    const headers = new Map<string, HeaderValue>();
    headers.set("plop", "test");
    // @ts-ignore
    session.email.attachments.push({
      contentDisposition: "plop",
      headers
    });
    let calls = [];
    let stub = sinon.stub(log.logger, "log").callsFake((...args) => {
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
}
