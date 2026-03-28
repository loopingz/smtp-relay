import { AddressObject } from "mailparser";
import * as nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import AddressParser from "nodemailer/lib/addressparser/index";
import { SmtpComponentConfig } from "../component";
import { SmtpProcessor } from "../processor";
import { mapAddressObjects, SmtpSession } from "../server";
import type { SingleKeyOptions } from "nodemailer/lib/dkim";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type Pojo<T> = {
  [K in keyof T]: T[K] extends Function ? never : T[K];
};

export interface NodeMailerProcessorConfig extends SmtpComponentConfig {
  type: "nodemailer";
  override?: Mail.Options;
  /**
   * You can define the nodemailer transport options here
   * @see https://nodemailer.com/usage/
   */
  nodemailer?: string | Pojo<SMTPTransport> | Pojo<SMTPTransport.Options>;
  /**
   * Configuration DKIM per sender domain
   */
  dkims?: {
    [domain: string]: Omit<SingleKeyOptions, "domainName">;
  };
}

export class NodeMailerProcessor<
  T extends NodeMailerProcessorConfig = NodeMailerProcessorConfig
> extends SmtpProcessor<T> {
  type: string = "nodemailer";
  transporter!: nodemailer.Transporter;

  /**
   * @override
   */
  init() {
    this.config.dkims ??= {};
    this.transporter = nodemailer.createTransport(this.config.nodemailer);
  }

  /**
   * Transform received email into a mail option for NodeMailer
   * @param email
   * @returns
   */
  static transformEmail(session: SmtpSession): Mail.Options {
    const email = session.email!;
    const addressTransformer = (a: AddressObject): string[] => {
      return a.value.map(ad => ad.address).filter((addr): addr is string => addr !== undefined);
    };
    // If no headers we do not fill the bcc as we have no to,cc headers
    if (email.headerLines?.length && !email.bcc) {
      const noBcc = [email.cc, email.to].flat().filter((a): a is AddressObject => !!a);
      const bcc: AddressObject[] = session.envelope.rcptTo
        .filter(a => {
          // Find address that are not included in the to/cc headers
          return !noBcc.find(b => b.value.find(v => v.address === a.address));
        })
        .map(a => ({ value: AddressParser(a.address), text: a.address, html: a.address }));
      if (bcc.length) {
        email.bcc = bcc.length === 1 ? bcc.pop() : bcc;
      }
    }
    return {
      from: email.from?.text,
      to: mapAddressObjects<string[]>(email.to, addressTransformer)?.flat(),
      cc: mapAddressObjects<string[]>(email.cc, addressTransformer)?.flat(),
      text: email.text,
      html: email.html === false ? undefined : email.html,
      subject: email.subject,
      attachments: email.attachments.map(a => ({
        ...a,
        contentDisposition: a.contentDisposition === "inline" ? "inline" : "attachment" as const,
        headers: ((headers: Map<string, string>) => {
          let res: { [key: string]: string } = {};
          [...headers.keys()].forEach(k => {
            res[k] = headers.get(k)!;
          });
          return res;
        })(a.headers as unknown as Map<string, string>)
      }))
    };
  }

  /**
   * Get the DKIM configuration for the specific domain
   * @param domain
   * @returns
   */
  getDkimForDomain(domain: string): SingleKeyOptions | undefined {
    for (const d in this.config.dkims) {
      if (d === domain) {
        return { ...this.config.dkims[d], domainName: d };
      }
    }
  }

  /**
   * Send with current NodeMailer transporter
   * @param session
   * @returns
   */
  async onMail(session: SmtpSession): Promise<void> {
    const domain = (<any>session.envelope.mailFrom.valueOf()).address.split("@").pop();
    return this.transporter.sendMail({
      ...NodeMailerProcessor.transformEmail(session),
      ...this.config.override,
      dkim: this.getDkimForDomain(domain)
    });
  }
}
