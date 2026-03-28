import { CloudEvent } from "cloudevents";
import { SmtpSession } from "./server";
import { AddressObject, ParsedMail } from "mailparser";
import { SMTPServerAddress } from "smtp-server";

/**
 * CloudEvent Data representation for smtp-relay
 */
export interface SmtpCloudEvent {
  email: {
    from?: AddressObject;
    attachments: {
      filename: string;
      size: number;
    }[];
    subject?: string;
    priority?: string;
    to?: AddressObject[];
    cc?: AddressObject[];
    bcc?: AddressObject[];
    replyTo?: string;
    date?: Date;
    text?: string;
    html?: string;
  };
  server: {
    clientHostname: string;
    remoteAddress: string;
    remotePort: number;
    hostNameAppearAs: string;
    id: string;
    secure: boolean;
    transmissionType: string;
    username: string;
  };
}

export function getCloudEvent<T extends SmtpCloudEvent = SmtpCloudEvent>(
  session: SmtpSession,
  truncation: number = 8192
): CloudEvent<T> {
  const getAddressObject = (arg: SMTPServerAddress | false) : AddressObject | undefined => {
    if (!arg) {
      return undefined;
    }
    return {
      value: [
        {
          address: arg.address,
          name: arg.address
        }
      ],
      html: arg.address,
      text: arg.address
    }
  }
  const email = session.email!;
  email.from ??= getAddressObject(session.envelope.mailFrom);
  email.to ??= session.envelope.rcptTo?.map(a => getAddressObject(a)).filter((a): a is AddressObject => a !== undefined);
  return new CloudEvent<T>({
    type: "com.loopingz.smtp-relay.v2",
    source: session.localAddress,
    time: session.time.toISOString(),
    subject: email?.messageId,
    data: <T>{
      email: ((e: ParsedMail) => ({
        from: e.from,
        attachments: e.attachments.map(a => ({
          filename: a.filename?.substring(0, truncation),
          size: a.size
        })),
        subject: e.subject?.substring(0, truncation),
        priority: e.priority,
        cc: e.cc,
        to: e.to,
        bcc: e.bcc,
        text: e.text?.substring(0, truncation),
        html: e.html ? e.html.substring(0, truncation) : undefined
      }))(email),
      server: {
        clientHostname: session.clientHostname.substring(0, truncation),
        remoteAddress: session.remoteAddress,
        remotePort: session.remotePort,
        hostNameAppearAs: session.hostNameAppearsAs,
        id: session.id,
        secure: session.secure,
        transmissionType: session.transmissionType,
        username: session.user
      }
    }
  });
}
