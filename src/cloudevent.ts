import { CloudEvent } from "cloudevents";
import { AddressObject } from "mailparser";
import { SmtpSession } from "./server";

/**
 * CloudEvent Data representation for smtp-relay
 */
export interface SmtpCloudEvent {
  email: {
    from?: string;
    attachments: {
      filename: string;
      size: number;
    }[];
    subject?: string;
    priority?: string;
    to?: string;
    cc?: string;
    bcc?: string;
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
  };
}

function mapAddressObjects(obj: AddressObject | AddressObject[] | undefined): string | undefined {
  if (!obj) {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(a => mapAddressObjects(a)).join(",");
  }
  return obj.value.map(ad => ad.address).join(",");
}

export function getCloudEvent<T extends SmtpCloudEvent = SmtpCloudEvent>(
  session: SmtpSession,
  truncation: number = 8192
): CloudEvent<T> {
  return new CloudEvent<T>({
    type: "com.loopingz.smtp-relay",
    source: session.localAddress,
    time: session.time.toISOString(),
    subject: session.email?.messageId,
    data: <T>{
      email: (email => ({
        from: email.from.value.shift().address.substr(0, truncation),
        attachments: email.attachments.map(a => ({
          filename: a.filename.substr(0, truncation),
          size: a.size
        })),
        subject: email.subject.substr(0, truncation),
        priority: email.priority,
        cc: mapAddressObjects(email.cc)?.substr(0, truncation),
        to: mapAddressObjects(email.to)?.substr(0, truncation),
        bcc: mapAddressObjects(email.bcc)?.substr(0, truncation),
        text: email.text?.substr(0, truncation),
        html: email.html ? email.html.substr(0, truncation) : undefined
      }))(session.email),
      server: {
        clientHostname: session.clientHostname.substr(0, truncation),
        remoteAddress: session.remoteAddress,
        remotePort: session.remotePort,
        hostNameAppearAs: session.hostNameAppearsAs,
        id: session.id,
        secure: session.secure,
        transmissionType: session.transmissionType
      }
    }
  });
}
