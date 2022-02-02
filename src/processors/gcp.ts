import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";

export class GCPMiddleware implements SmtpProcessor {
  type: string = "gcp";
  config: {
    storage: string;
    pubsub: string;
  };

  async onMail(session: SmtpSession): Promise<void> {}
}
