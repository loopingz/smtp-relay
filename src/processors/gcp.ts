import { PubSub } from "@google-cloud/pubsub";
import { Storage } from "@google-cloud/storage";
import { CloudProcessor, CloudProcessorConfig } from "./cloud";

/**
 * Configuration for GCPProcessor
 */
export interface GCPProcessorConfig extends CloudProcessorConfig {}

/**
 * This processor can store email within Google Storage or send a cloudevent to a topic
 */
export class GCPProcessor<T extends GCPProcessorConfig = GCPProcessorConfig> extends CloudProcessor<T> {
  async storeFile(destination: string, sourceFile: string): Promise<void> {
    await this.storage.bucket(this.config.storage.bucket).upload(sourceFile, {
      destination
    });
  }

  async storeData(destination: string, data: string | Buffer): Promise<void> {
    return this.storage.bucket(this.config.storage.bucket).file(destination).save(data);
  }

  async publishMessage(message: string): Promise<void> {
    await this.pubsub.topic(this.config.pubsub.topic).publishMessage({ data: Buffer.from(message) });
  }

  type: string = "gcp";
  storage: Storage;
  pubsub: PubSub;

  /**
   * @override
   */
  init() {
    super.init();
    this.storage = new Storage();
    this.pubsub = new PubSub();
  }
}
