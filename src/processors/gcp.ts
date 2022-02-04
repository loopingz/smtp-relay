import { SmtpProcessor } from "../processor";
import { SmtpServer, SmtpSession } from "../server";
import { SmtpComponentConfig } from "../component";
import { Storage } from "@google-cloud/storage";
import { PubSub } from "@google-cloud/pubsub";
import { getCloudEvent } from "../cloudevent";

/**
 * Configuration for GCPProcessor
 */
export interface GCPProcessorConfig extends SmtpComponentConfig {
  /**
   * Store email or part of email within a Google Storage
   */
  storage?: {
    /**
     * Bucket name
     */
    bucket: string;
    /**
     * Path on this bucket
     */
    path: string;
    /**
     * Part of the email to save
     *
     * raw: the whole email as received by our SMTP
     * attachments: any files attached to the email, ignoring emails without attachments
     * text: The text content of the email if it exists
     * html: The html content of the email if it exists
     *
     * @default "raw"
     */
    type?: "raw" | "attachments" | "text" | "html";
  };
  /**
   * Publish a cloudevent on the topic of Google PubSub if set
   */
  pubsub?: {
    /**
     * Define the maximum size for subject,html,text
     * @default 8192
     */
    truncate?: number;
    /**
     * Topic to use for publishing
     */
    topic: string;
  };
}

/**
 * This processor can store email within Google Storage or send a cloudevent to a topic
 */
export class GCPProcessor<T extends GCPProcessorConfig = GCPProcessorConfig> extends SmtpProcessor<T> {
  type: string = "gcp";
  storage: Storage;
  pubsub: PubSub;

  /**
   * @override
   */
  init() {
    this.storage = new Storage();
    this.pubsub = new PubSub();
    if (this.config.storage) {
      this.config.storage.type ??= "raw";
      if (!this.config.storage.bucket) {
        throw new Error("Need to specify a bucket for CloudStorage");
      }
      if (!this.config.storage.path) {
        throw new Error("Need to specify a path for CloudStorage");
      }
    }
    if (this.config.pubsub) {
      if (!this.config.pubsub.topic) {
        throw new Error("Need to specify a topic for PubSub");
      }
    }
  }

  /**
   * Store the email inside Google Storage based on the configuration
   * @param session
   */
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

  /**
   * @override
   */
  async onMail(session: SmtpSession): Promise<void> {
    if (this.config.storage) {
      await this.store(session);
    }
    if (this.config.pubsub) {
      console.log(`Output[${this.name}] Publishing cloudevent to ${this.config.pubsub.topic}`);
      let id = await this.pubsub
        .topic(this.config.pubsub.topic)
        .publishMessage({ data: Buffer.from(JSON.stringify(getCloudEvent(session, this.config.pubsub.truncate))) });
      console.log(`Output[${this.name}] Published cloudevent with ${id}`);
    }
  }
}
