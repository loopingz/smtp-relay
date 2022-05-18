import { suite, test } from "@testdeck/mocha";
import * as assert from "assert";
import { HeaderValue } from "mailparser";
import * as sinon from "sinon";
import { SmtpSession } from "../server";
import { getFakeSession } from "../server.spec";
import { NodeMailerProcessor } from "./nodemailer";

@suite
class NodeMailerProcessorTest {
  @test
  async mailer() {
    let nodemailer = new NodeMailerProcessor(undefined, {
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
    });

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
}
