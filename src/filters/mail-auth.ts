import { SmtpComponentConfig } from "../component";
import { SmtpFilter } from "../filter";
import { SmtpSession } from "../server";
import { authenticate } from "mailauth";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import dns from "node:dns/promises";

export interface MailAuthConfig extends SmtpComponentConfig {
  type: "mail-auth";
  /**
   * See https://www.npmjs.com/package/mailauth
   */
  mailauth?: {
    /**
     *  the minimum allowed bits of RSA public keys (defaults to 1024). If a DKIM or ARC key has fewer bits, then validation is considered as failed
     * @default 1024
     */
    minBitLength?: number;
    /**
     * Disable ARC checks
     */
    disableArc?: boolean;
    /**
     * Disable Dmarc checks
     */
    disableDmarc?: boolean;
    /**
     * Disable Bimi checks
     */
    disableBimi?: boolean;
    /**
     * DNS lookup limit for SPF. RFC7208 requires this limit to be 10.
     *
     * @default 10
     */
    maxResolveCount?: number;
    /**
     * DNS lookup limit for SPF that produce an empty result. RFC7208 requires this limit to be 2.
     */
    maxVoidCount?: number;
  };
  /**
   * Enforce DMARC policy. If set all _dmarc records are replaced with the policy set here.s
   */
  enforceDmarc?: string;
}

/**
 * Ensure SPF, DKIM, DMARC, ARC, BIMI and Received headers are valid
 */
export class MailAuthFilter extends SmtpFilter<MailAuthConfig> {
  type: string = "mail-auth";

  async onData(session: SmtpSession, flow: string): Promise<boolean> {
    const { dkim, spf, arc, dmarc, bimi, receivedChain, headers } = await authenticate(
      createReadStream(session.emailPath),
      {
        ...this.config.mailauth,
        sender: session.envelope.mailFrom !== false ? session.envelope.mailFrom.address : undefined,
        helo: session.hostNameAppearsAs,
        ip: session.remoteAddress,
        resolver: this.config.enforceDmarc
          ? async (domain: string, type: string) => {
              if (domain.startsWith("_dmarc.")) {
                return [[this.config.enforceDmarc]];
              }
              return this.config.mailauth["resolver"]
                ? this.config.mailauth["resolver"](domain, type)
                : dns.resolve(domain, type);
            }
          : this.config.mailauth["resolver"]
      }
    );
    session.context[flow] = { dkim, spf, dmarc, arc, bimi, receivedChain, headers };

    if (dmarc !== false && dmarc?.status.result === "fail" && dmarc.policy === "reject") {
      return false;
    }

    // Append headers to the email
    const originalContent = await readFile(session.emailPath, "utf8");
    await writeFile(session.emailPath, headers + originalContent, "utf8");

    return true;
  }
}
