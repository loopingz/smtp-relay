import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";

export class PackerMiddleware implements SmtpProcessor {
  type: string = "packer";
  config: {
    sqs: string;
    s3: string;
  };

  async onMail(session: SmtpSession): Promise<void> {}
}
