import { PutObjectCommandInput, S3, S3ClientConfig } from "@aws-sdk/client-s3";
import { SendRawEmailCommandInput, SES, SESClientConfig } from "@aws-sdk/client-ses";
import { SendMessageCommandInput, SQS, SQSClientConfig } from "@aws-sdk/client-sqs";
import * as fs from "fs";
import { SmtpSession } from "../server";
import { CloudProcessor, CloudProcessorConfig } from "./cloud";

export interface AWSProcessorConfig extends CloudProcessorConfig {
  ses?: boolean;
  s3client?: S3ClientConfig;
  putOptions?: PutObjectCommandInput;
  sqsclient?: SQSClientConfig;
  sendMessageOptions?: SendMessageCommandInput;
  sesClient?: SESClientConfig;
  sendRawEmailOptions?: SendRawEmailCommandInput;
}

export class AWSProcessor<T extends AWSProcessorConfig = AWSProcessorConfig> extends CloudProcessor<T> {
  s3: S3;
  sqs: SQS;
  ses: SES;

  /**
   * @override
   */
  async storeData(destination: string, content: string | Buffer): Promise<void> {
    await this.s3.putObject({
      ...this.config.putOptions,
      Bucket: this.config.storage.bucket,
      Key: destination,
      Body: content
    });
  }

  /**
   * @override
   */
  async storeFile(destination: string, sourceFile: string): Promise<void> {
    await this.s3.putObject({
      Bucket: this.config.storage.bucket,
      Key: destination,
      Body: fs.createReadStream(sourceFile)
    });
  }

  /**
   * @override
   */
  async publishMessage(message: string): Promise<void> {
    await this.sqs.sendMessage({
      ...this.config.sendMessageOptions,
      MessageBody: message,
      QueueUrl: this.config.pubsub.topic
    });
  }

  type: string = "aws";

  /**
   * @override
   */
  init() {
    super.init();
    this.s3 = new S3(this.config.s3client || {});
    this.sqs = new SQS(this.config.sqsclient || {});
    this.ses = new SES(this.config.sesClient || {});
  }

  /**
   * Add SES management on top of normal storage and pubsub
   * @param session
   */
  async onMail(session: SmtpSession) {
    await super.onMail(session);
    if (this.config.ses) {
      await this.ses.sendRawEmail({
        RawMessage: { Data: fs.readFileSync(session.emailPath) },
        ...this.config.sendRawEmailOptions
      });
    }
  }
}
