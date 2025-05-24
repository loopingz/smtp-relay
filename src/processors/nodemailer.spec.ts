import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { HeaderValue } from "mailparser";
import * as sinon from "sinon";
import { SmtpSession } from "../server";
import { getFakeSession } from "../server.spec";
import { NodeMailerProcessor } from "./nodemailer";

@suite
class NodeMailerProcessorTest {
  @test
  async dkim() {
    const dkimConfig = {
      "example.com": {
        keySelector: "testselector",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAuQ==\n-----END PRIVATE KEY-----"
      }
    };
    const processor = new NodeMailerProcessor(
      undefined,
      {
        type: "nodemailer",
        nodemailer: {
          host: "smtp.example.com",
          port: 587,
          secure: false,
          auth: { user: "username", pass: "password" }
        },
        dkims: dkimConfig
      },
      new WorkerOutput()
    );
    const session: SmtpSession = getFakeSession();
    session.envelope.mailFrom = { address: "sender@example.com", args: [] };
    let sendMailArg: any;
    sinon.stub(processor.transporter, "sendMail").callsFake(arg => {
      sendMailArg = arg;
      return Promise.resolve();
    });
    await processor.onMail(session);
    assert.ok(sendMailArg.dkim, "DKIM option should be set");
    assert.strictEqual(sendMailArg.dkim.domainName, "example.com");
    assert.strictEqual(sendMailArg.dkim.keySelector, "testselector");
    assert.strictEqual(sendMailArg.dkim.privateKey, dkimConfig["example.com"].privateKey);
    session.envelope.mailFrom = { address: "sender@toto.com", args: [] };
    await processor.onMail(session);
    assert.ok(!sendMailArg.dkim, "DKIM option should not be set");
  }

  @test
  async mailer() {
    let nodemailer = new NodeMailerProcessor(
      undefined,
      {
        type: "nodemailer",
        nodemailer: {
          host: "smtp.example.com",
          port: 587,
          secure: false, // upgrade later with STARTTLS
          auth: {
            user: "username",
            pass: "password"
          }
        }
      },
      new WorkerOutput()
    );

    let session: SmtpSession = getFakeSession();
    let msg;
    sinon.stub(nodemailer.transporter, "sendMail").callsFake(arg => {
      msg = arg;
    });

    session.email.to = [
      {
        html: "",
        text: "",
        value: [{ name: "", address: "" }]
      }
    ];
    const headers = new Map<string, HeaderValue>();
    headers.set("plop", "test");
    // @ts-ignore
    session.email.attachments.push({
      contentDisposition: "plop",
      headers
    });
    await nodemailer.onMail(session);
    assert.notStrictEqual(msg, undefined);
  }

  @test
  async bccResolution() {
    const session = getFakeSession();
    let nodemailer = new NodeMailerProcessor(
      undefined,
      {
        type: "nodemailer",
        nodemailer: {
          host: "smtp.example.com",
          port: 587,
          secure: false, // upgrade later with STARTTLS
          auth: {
            user: "username",
            pass: "password"
          }
        }
      },
      new WorkerOutput()
    );
    session.envelope.rcptTo = [
      { address: "bcc@test.com", args: [] },
      { address: "to@test.com", args: [] },
      { address: "cc@test.com", args: [] }
    ];
    session.email.cc = [
      {
        html: "",
        text: "",
        value: [{ name: "", address: "cc@test.com" }]
      }
    ];
    session.email.to = [
      {
        html: "",
        text: "",
        value: [{ name: "", address: "to@test.com" }]
      }
    ];
    session.email.headerLines = [{ key: "plop", line: "test" }];
    NodeMailerProcessor.transformEmail(session);
    assert.deepStrictEqual(session.email.bcc, {
      html: "bcc@test.com",
      text: "bcc@test.com",
      value: [
        {
          address: "bcc@test.com",
          name: ""
        }
      ]
    });
  }
}
