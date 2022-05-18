import { suite, test } from "@testdeck/mocha";
import * as assert from "assert";
import * as fs from "fs";
import * as sinon from "sinon";
import { SmtpSession } from "../server";
import { getFakeSession } from "../server.spec";
import { AWSProcessor } from "./aws";

@suite
class AWSProcessorTest {
  @test
  async cov() {
    // @ts-ignore
    assert.throws(() => new AWSProcessor(undefined, { storage: {} }), /Need to specify a bucket for CloudStorage/);
    // @ts-ignore
    assert.throws(() => new AWSProcessor(undefined, { pubsub: {} }), /Need to specify a topic for PubSub/);
    assert.throws(
      // @ts-ignore
      () => new AWSProcessor(undefined, { storage: { bucket: "Test" } }),
      /Need to specify a path for CloudStorage/
    );
  }

  @test
  async pubsub() {
    let aws = new AWSProcessor(undefined, { type: "aws", pubsub: { topic: "test" } });
    let session: SmtpSession = getFakeSession();
    let evt;
    sinon.stub(aws.sqs, "sendMessage").callsFake(data => {
      evt = data;
    });
    await aws.onMail(session);
    assert.notStrictEqual(evt, undefined);
  }

  @test
  async storage() {
    let aws: AWSProcessor = new AWSProcessor(undefined, {
      type: "aws",
      storage: { bucket: "test", path: "${id}.eml" }
    });
    let session: SmtpSession = getFakeSession();
    let cmd;
    // Test raw
    sinon.stub(aws.s3, "putObject").callsFake(arg => {
      cmd = arg;
    });
    session.emailPath = "./src/index.ts";
    await aws.onMail(session);
    assert.deepStrictEqual(cmd.Bucket, "test");
    assert.deepStrictEqual(cmd.Key, "1234.eml");

    cmd = undefined;
    session.email.html = "Coucou";
    aws.config.storage.type = "html";
    // No text to save
    await aws.onMail(session);
    assert.deepStrictEqual(cmd.Bucket, "test");
    assert.deepStrictEqual(cmd.Key, "1234.eml");
    assert.deepStrictEqual(cmd.Body, "Coucou");
  }

  @test
  async ses() {
    let aws: AWSProcessor = new AWSProcessor(undefined, {
      type: "aws",
      ses: true
    });
    let session: SmtpSession = getFakeSession();
    let cmd;
    // Test raw
    sinon.stub(aws.ses, "sendRawEmail").callsFake(arg => {
      cmd = arg;
    });
    session.emailPath = "./src/index.ts";
    await aws.onMail(session);
    assert.deepStrictEqual(cmd.RawMessage.Data.toString(), fs.readFileSync("./src/index.ts").toString());
  }
}
