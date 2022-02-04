import { getCloudEvent } from "../cloudevent";
import { SmtpComponentConfig } from "../component";
import { SmtpProcessor } from "../processor";
import { SmtpServer, SmtpSession } from "../server";

/**
 * Configuration for GCPProcessor
 */
export interface CloudProcessorConfig extends SmtpComponentConfig {
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

export abstract class CloudProcessor<T extends CloudProcessorConfig = CloudProcessorConfig> extends SmtpProcessor<T> {
  /**
   * @override
   */
  init() {
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

  abstract storeData(destination: string, content: Buffer | string): Promise<void>;
  abstract storeFile(destination: string, sourceFile: string): Promise<void>;
  abstract publishMessage(message: string): Promise<void>;

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
        await this.storeData(destFileName, attachment.content);
      }
    } else {
      const destFileName = SmtpServer.replaceVariables(this.config.storage.path, session);
      if (this.config.storage.type === "raw") {
        console.log(`Output[${this.name}] Storing ${this.config.type} to ${destFileName}`);
        await this.storeFile(destFileName, session.emailPath);
      } else {
        let data: string;
        if (this.config.storage.type === "text") {
          data = session.email.text;
        } else if (this.config.storage.type === "html" && session.email.html !== false) {
          data = session.email.html;
        }
        if (data) {
          console.log(`Output[${this.name}] Storing ${this.config.storage.type} to ${destFileName}`);
          await this.storeData(destFileName, data);
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
      await this.publishMessage(JSON.stringify(getCloudEvent(session, this.config.pubsub.truncate)));
    }
  }
}
