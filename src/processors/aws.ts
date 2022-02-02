import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";

export class AWSMiddleware implements SmtpProcessor {
  type: string = "aws";
  config: {
    sqs: string;
    s3: string;
  };

  async onMail(session: SmtpSession): Promise<void> {}
}
