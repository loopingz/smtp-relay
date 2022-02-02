import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";

export class MailerMiddleware implements SmtpProcessor {
  type: string = "nodemailer";
  config: {
    redirect: string;
  };

  async onMail(session: SmtpSession): Promise<void> {}
}
