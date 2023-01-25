import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { Attachment } from "mailparser";
import * as sinon from "sinon";
import { SmtpSession } from "../server";
import { getFakeSession } from "../server.spec";
import { GCPProcessor } from "./gcp";

@suite
class GCPProcessorTest {
  @test
  async cov() {
    // @ts-ignore
    assert.throws(() => new GCPProcessor(undefined, { storage: {} }), /Need to specify a bucket for CloudStorage/);
    // @ts-ignore
    assert.throws(() => new GCPProcessor(undefined, { pubsub: {} }), /Need to specify a topic for PubSub/);
    assert.throws(
      // @ts-ignore
      () => new GCPProcessor(undefined, { storage: { bucket: "Test" } }),
      /Need to specify a path for CloudStorage/
    );
  }

  @test
  async pubsub() {
    let gcp = new GCPProcessor(undefined, { type: "gcp", pubsub: { topic: "test" } }, new WorkerOutput());
    let session: SmtpSession = getFakeSession();
    let evt;
    sinon.stub(gcp.pubsub, "topic").callsFake(() => {
      return {
        publishMessage: ({ data }) => {
          evt = data;
        }
      };
    });
    await gcp.onMail(session);
    assert.notStrictEqual(evt, undefined);
  }

  @test
  async storage() {
    let gcp: GCPProcessor = new GCPProcessor(
      undefined,
      {
        type: "gcp",
        storage: { bucket: "test", path: "${id}.eml" }
      },
      new WorkerOutput()
    );
    let session: SmtpSession = getFakeSession();
    let filename;
    let destination;
    let content;
    let bucket;
    // Test raw
    sinon.stub(gcp.storage, "bucket").callsFake(bucketname => {
      bucket = bucketname;
      return {
        file: argFilename => {
          filename = argFilename;
          return {
            save: argContent => {
              content = argContent;
            }
          };
        },
        upload: (argFilename, params) => {
          filename = argFilename;
          destination = params.destination;
        }
      };
    });
    await gcp.onMail(session);
    assert.strictEqual(bucket, "test");
    assert.strictEqual(filename, "unit-test-fake-path");
    assert.strictEqual(destination, "1234.eml");

    bucket = filename = destination = undefined;
    gcp.config.storage.type = "text";
    // No text to save
    await gcp.onMail(session);
    assert.strictEqual(bucket, undefined);

    session.email.html = "Coucou";
    bucket = filename = destination = undefined;
    gcp.config.storage.type = "html";
    // HTML export
    await gcp.onMail(session);
    assert.strictEqual(bucket, "test");
    assert.strictEqual(filename, "1234.eml");
    assert.strictEqual(content, "Coucou");

    // Attachments exports
    bucket = filename = destination = undefined;
    gcp.config.storage.type = "attachments";
    gcp.config.storage.path = "${id}_${attachment}";
    await gcp.onMail(session);
    assert.strictEqual(bucket, undefined);
    session.email.attachments.push(<Attachment>(<unknown>{
      filename: "plop",
      content: Buffer.from("Coucou")
    }));
    await gcp.onMail(session);
    assert.strictEqual(bucket, "test");
    assert.strictEqual(filename, "1234_plop");
    assert.deepStrictEqual(content.toString(), "Coucou");
    session.email.attachments = [<Attachment>(<unknown>{
        content: Buffer.from("Coucou")
      })];
    await gcp.onMail(session);
    assert.strictEqual(bucket, "test");
    assert.strictEqual(filename, "1234_attachment_0");
    assert.deepStrictEqual(content.toString(), "Coucou");
  }
}
