import { SmtpComponentConfig } from "../component";
import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";
import { NodeMailerProcessor } from "./nodemailer";

export interface LogProcessorConfig extends SmtpComponentConfig {
  type: "log";
  /**
   * Fields to log
   * 
   * @default ["from", "to", "cc", "subject", "text"]
   */
  fields?: string[];
}

export class LogProcessor<
  T extends LogProcessorConfig = LogProcessorConfig
> extends SmtpProcessor<T> {
  type: string = "log";

  init(): void {
      this.config.fields ??= ["from", "to", "cc", "subject", "text"];
  }

  /**
   * Send with current NodeMailer transporter
   * @param session
   * @returns
   */
  async onMail(session: SmtpSession): Promise<void> {
    const email = NodeMailerProcessor.transformEmail(session.email);
    let content = `Email received ${new Date().toISOString()} from ${session.remoteAddress}
${"-".repeat(80)}
`;
    this.config.fields.filter(f => email[f] !== undefined).forEach(f => {
        let value = email[f];
        if (value instanceof Array) {
            value = email[f].join(", ");
        }
        content += `${f}: ${value}\n`;
    });
    content += `${"-".repeat(80)}\n`
    this.logger.log("INFO", content);
  }
}
