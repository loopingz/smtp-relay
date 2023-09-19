import { suite, test } from "@testdeck/mocha";
import * as assert from "assert";
import { Attachment } from "mailparser";
import { getCloudEvent } from "./cloudevent";
import { getFakeSession } from "./server.spec";

@suite
class CloudEventTest {
  @test
  default() {
    let session = getFakeSession();

    session.email.cc = [];
    session.email.bcc = [
      {
        html: "",
        text: "",
        value: [
          {
            name: "",
            address: "test@test.com"
          }
        ]
      }
    ];
    session.email.to = {
      html: "",
      text: "",
      value: [
        {
          name: "",
          address: "test@test.com"
        }
      ]
    };
    session.email.attachments.push(<Attachment>(<unknown>{
      content: Buffer.from("Coucou")
    }));
    session.email.subject = "1234".repeat(4096);
    session.email.text = "My text";
    session.email.html = "My html";
    let evt = getCloudEvent(session);
    // Should have been truncated
    assert.strictEqual(evt.data.email.subject, "1234".repeat(2048));
  }

  @test
  fallback() {
    let session = getFakeSession();

    session.envelope.mailFrom = false;
    session.envelope.rcptTo = [
      {
        address: "test@test.com",
        args: {}
      }
    ]
    // @ts-ignore
    session.email = {};
    session.email.attachments = [];
    let evt = getCloudEvent(session);
    // Should have been truncated
    assert.strictEqual(evt.data.email.to[0].value[0].address, "test@test.com");
  }
}
