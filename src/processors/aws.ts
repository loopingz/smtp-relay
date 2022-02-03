import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";
import { SmtpComponentConfig } from "../component";

export interface AWSProcessorConfig extends SmtpComponentConfig {
  sqs: string;
  s3: string;
}
export class AWSProcessor<T extends AWSProcessorConfig = AWSProcessorConfig> extends SmtpProcessor<T> {
  type: string = "aws";

  async onMail(session: SmtpSession): Promise<void> {}
}
