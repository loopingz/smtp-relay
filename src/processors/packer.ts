import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";

export class PackerProcessor extends SmtpProcessor {
  type: string = "packer";

  async onMail(session: SmtpSession): Promise<void> {}
}
