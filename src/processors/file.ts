import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";

export class FileProcessor implements SmtpProcessor {
  type: string = "file";

  async onMail(session: SmtpSession): Promise<void> {}
}
