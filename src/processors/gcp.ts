import { SmtpProcessor } from "../processor";
import { SmtpServer, SmtpSession } from "../server";
import { SmtpComponentConfig } from "../component";
import { Storage } from "@google-cloud/storage";
import { PubSub } from "@google-cloud/pubsub";
import { getCloudEvent } from "../cloudevent";

export interface GCPProcessorConfig extends SmtpComponentConfig {
  storage?: {
    bucket: string;
    path: string;
    type: "raw" | "attachments" | "text" | "html";
  };
  pubsub?: {
    /**
     * Define the maximum size for subject,html,text
     * @default 8192
     */
    truncate?: number;
    topic: string;
  };
}
export class GCPProcessor<T extends GCPProcessorConfig = GCPProcessorConfig> extends SmtpProcessor<T> {
  type: string = "gcp";
  storage: Storage;
  pubsub: PubSub;

  init() {
    this.storage = new Storage();
    this.pubsub = new PubSub();
  }

  async store(session: SmtpSession) {
    if (this.config.storage.type === "attachments") {
      if (session.email.attachments.length === 0) {
        console.log(`Output[${this.name}] No attachment ignoring ${session.email.messageId}`);
      }
      for (const i in session.email.attachments) {
        const attachment = session.email.attachments[i];
        const destFileName = SmtpServer.replaceVariables(this.config.storage.path, session, {
          attachment: attachment.filename || `attachment_${i}`
        });
        console.log(`Output[${this.name}] Storing attachment ${attachment.filename} to ${destFileName}`);
        await this.storage.bucket(this.config.storage.bucket).file(destFileName).save(attachment.content);
      }
    } else {
      const destFileName = SmtpServer.replaceVariables(this.config.storage.path, session);
      if (this.config.storage.type === "raw") {
        console.log(`Output[${this.name}] Storing ${this.config.type} to ${destFileName}`);
        await this.storage.bucket(this.config.storage.bucket).upload(session.emailPath, {
          destination: destFileName
        });
      } else {
        let data: string;
        if (this.config.storage.type === "text") {
          data = session.email.text;
        } else if (this.config.storage.type === "html" && session.email.html !== false) {
          data = session.email.html;
        }
        if (data) {
          console.log(`Output[${this.name}] Storing ${this.config.storage.type} to ${destFileName}`);
          await this.storage.bucket(this.config.storage.bucket).file(destFileName).save(data);
        } else {
          console.log(`Output[${this.name}] No data(${this.config.storage.type}) ignoring ${session.email.messageId}`);
        }
      }
    }
  }

  async onMail(session: SmtpSession): Promise<void> {
    if (this.config.storage) {
      await this.store(session);
    }
    if (this.config.pubsub) {
      console.log(`Output[${this.name}] Publishing cloudevent to ${this.config.pubsub.topic}`);
      let id = await this.pubsub
        .topic(this.config.pubsub.topic)
        .publish(Buffer.from(JSON.stringify(getCloudEvent(session, this.config.pubsub.truncate))));
      console.log(`Output[${this.name}] Published cloudevent with ${id}`);
    }
  }
}
