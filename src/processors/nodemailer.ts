import { ParsedMail } from "mailparser";
import * as nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { SmtpComponentConfig } from "../component";
import { SmtpProcessor } from "../processor";
import { mapAddressObjects, SmtpSession } from "../server";

export interface NodeMailerProcessorConfig extends SmtpComponentConfig {
  type: "nodemailer";
  override?: Mail.Options;
  nodemailer?: string | any; //SMTPTransport | Omit<SMTPTransport.Options, "getSocket">;
}

export class NodeMailerProcessor<
  T extends NodeMailerProcessorConfig = NodeMailerProcessorConfig
> extends SmtpProcessor<T> {
  type: string = "nodemailer";
  transporter: nodemailer.Transporter;

  /**
   * @override
   */
  init() {
    this.transporter = nodemailer.createTransport(this.config.nodemailer);
  }

  /**
   * Transform received email into a mail option for NodeMailer
   * @param email
   * @returns
   */
  static transformEmail(email: ParsedMail): Mail.Options {
    const addressTransformer = a => {
      return a.value.map(ad => ad.address);
    };
    return {
      from: email.from.text,
      to: mapAddressObjects<string[]>(email.to, addressTransformer)?.flat(),
      cc: mapAddressObjects<string[]>(email.cc, addressTransformer)?.flat(),
      text: email.text,
      html: email.html ? email.html : undefined,
      subject: email.subject,
      attachments: email.attachments.map(a => ({
        ...a,
        contentDisposition: a.contentDisposition === "inline" ? "inline" : "attachment",
        headers: (headers => {
          let res = {};
          [...headers.keys()].forEach(k => {
            res[k] = headers.get(k);
          });
          return res;
        })(a.headers)
      }))
    };
  }

  /**
   * Send with current NodeMailer transporter
   * @param session
   * @returns
   */
  async onMail(session: SmtpSession): Promise<void> {
    return this.transporter.sendMail({ ...NodeMailerProcessor.transformEmail(session.email), ...this.config.override });
  }
}
