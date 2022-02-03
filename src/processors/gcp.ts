import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";
import { SmtpComponentConfig } from "../component";

export interface GCPProcessorConfig extends SmtpComponentConfig {
  storage: string;
  pubsub: string;
}
export class GCPProcessor<T extends GCPProcessorConfig = GCPProcessorConfig> extends SmtpProcessor<T> {
  type: string = "gcp";

  async onMail(session: SmtpSession): Promise<void> {
    // TODO Implement the AWS
  }
}
