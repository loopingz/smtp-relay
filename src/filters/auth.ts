import { SMTPServerDataStream } from "smtp-server";
import { SmtpComponentConfig, SmtpComponentDependencies } from "../component";
import { SmtpFilter } from "../filter";
import { SmtpSession } from "../server"; // Correctly import SmtpSession
import { authenticate as mailAuthAuthenticate, AuthResults } from "mailauth"; // Import authenticate function and types
import * as os from "os";

export interface AuthFilterConfig extends SmtpComponentConfig {
  type: "auth";
  mtaHostname?: string; // Hostname of the server performing authentication
  dkim?: {
    policy?: "accept" | "reject" | "tag"; // Default: tag
  };
  spf?: {
    policy?: "accept" | "reject" | "tag"; // Default: tag
  };
  mailauthOptions?: Record<string, any>; // To pass additional options like a mock resolver
  // TODO: Add DMARC, ARC, BIMI policies if needed
}

export class AuthFilter extends SmtpFilter<AuthFilterConfig> {
  type: string = "auth";
  private mtaHostname: string;
  private mailauthOptions: Record<string, any>;

  constructor(config: AuthFilterConfig, deps: SmtpComponentDependencies) {
    super(config, deps);
    this.mtaHostname = config.mtaHostname || os.hostname();
    this.mailauthOptions = config.mailauthOptions || {};
    this.logger.info("AuthFilter initialized with config: %j, mtaHostname: %s, mailauthOptions: %j", this.config, this.mtaHostname, this.mailauthOptions);

    // Set default policies if not provided
    this.config.dkim = { policy: "tag", ...config.dkim };
    this.config.spf = { policy: "tag", ...config.spf };
  }

  async onData(stream: SMTPServerDataStream, session: SmtpSession, callback: (err?: Error | null, code?: string) => void): Promise<void> {
    this.logger.info("AuthFilter onData called for session: %s with mailauthOptions: %j", session.id, this.mailauthOptions);
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    stream.on("end", async () => {
      const emailBuffer = Buffer.concat(chunks);
      try {
        const remoteIp = session.remoteAddress;
        const heloHostname = session.clientHostname || "localhost"; // clientHostname can be undefined
        const mailFrom = session.envelope.mailFrom?.address || ""; // mailFrom can be null

        if (!remoteIp) {
          this.logger.warn("Remote IP address is not available, skipping authentication. Session: %s", session.id);
          return callback(); // Accept if IP is missing (or handle as per policy)
        }

        this.logger.info(`Performing email authentication for IP: ${remoteIp}, HELO: ${heloHostname}, From: ${mailFrom}, MTA: ${this.mtaHostname}`);

        const authResults: AuthResults = await mailAuthAuthenticate(emailBuffer, {
          ip: remoteIp,
          helo: heloHostname,
          sender: mailFrom,
          mta: this.mtaHostname,
          ...this.mailauthOptions, // Spread additional options, like a mock resolver for tests
        });

        this.logger.info("MailAuth verification results for session %s: DKIM: %s, SPF: %s, DMARC: %s",
          session.id,
          authResults.dkim?.results[0]?.status.result || "N/A",
          authResults.spf?.status.result || "N/A",
          authResults.dmarc?.status.result || "N/A"
        );
        
        // Handle SPF result
        const spfResult = authResults.spf?.status.result;
        if (spfResult && spfResult !== "pass" && spfResult !== "none" && spfResult !== "neutral") { // none and neutral are often treated as acceptable
          if (this.config.spf?.policy === "reject") {
            this.logger.warn(`SPF check failed with result '${spfResult}' and policy is 'reject'. Rejecting email from ${mailFrom} (session ${session.id}).`);
            return callback(new Error(`SPF check failed: ${authResults.spf?.status.comment || spfResult}`), "550 5.7.23"); // RFC 5321: 5.7.23 SPF check failed
          } else if (this.config.spf?.policy === "tag") {
            this.logger.info(`SPF check failed with result '${spfResult}' and policy is 'tag'. Email from ${mailFrom} will be tagged (session ${session.id}).`);
            // TODO: Implement actual tagging (e.g., add Authentication-Results header or a custom header)
            // For now, we rely on mailauth's returned 'headers' which includes Authentication-Results
            // This header should be prepended to the email by the SmtpServer logic if we pass it back.
            // For now, we are not modifying the stream here.
          }
        }

        // Handle DKIM result (considers the first signature result)
        const dkimFirstResult = authResults.dkim?.results[0]?.status.result;
        if (dkimFirstResult && dkimFirstResult !== "pass") {
          if (this.config.dkim?.policy === "reject") {
            this.logger.warn(`DKIM check failed with result '${dkimFirstResult}' and policy is 'reject'. Rejecting email from ${mailFrom} (session ${session.id}).`);
            return callback(new Error(`DKIM check failed: ${authResults.dkim?.results[0]?.status.comment || dkimFirstResult}`), "550 5.7.24"); // RFC 5321: 5.7.24 DKIM check failed
          } else if (this.config.dkim?.policy === "tag") {
            this.logger.info(`DKIM check failed with result '${dkimFirstResult}' and policy is 'tag'. Email from ${mailFrom} will be tagged (session ${session.id}).`);
            // TODO: Implement actual tagging (as above for SPF)
          }
        }
        
        // If all checks passed or policies are 'accept'/'tag' (and tagging is handled later or by default Authentication-Results)
        this.logger.info("Email authentication passed or policies allow. Accepting email from %s (session %s)", mailFrom, session.id);
        
        // TODO: Prepend authResults.headers to the email content if policy is 'tag'
        // This is complex because we've already consumed the stream.
        // A better approach would be to make this filter a stream transformer if direct modification is needed here.
        // For now, we assume the SmtpServer or a subsequent component might use these results
        // or that the `Authentication-Results` header added by `mailauth` is sufficient.
        // The `SmtpServer` in this project already has a `HeadersTransform` capability.

        callback(); // Accept the email
      } catch (error: any) {
        this.logger.error("Error during email authentication for session %s: %s", session.id, error.message, error.stack);
        // Default to accept on error to avoid blocking emails, can be configured
        callback(); 
      }
    });

    stream.on("error", (err: Error) => {
      this.logger.error("Error in email data stream for session %s: %s", session.id, err.message, err.stack);
      // Pass a generic error to callback, as specific SMTP codes might not be appropriate here
      callback(new Error("Error processing email data")); 
    });
  }
}
