import * as crypto from "crypto";
import { SMTPServerAuthentication } from "smtp-server";
import { SmtpComponentConfig } from "../component";
import { SmtpFilter } from "../filter";

/**
 * Define a static auth
 */
export interface StaticAuthConfiguration extends SmtpComponentConfig {
  type: "static-auth";
  /**
   * User to use for Authentication
   *
   * If not define will search for SMTP_USERNAME environment variable
   */
  username?: string;
  /**
   * Staticly defined password
   *
   * If not define will search for SMTP_PASSWORD environment variable
   */
  password?: string;
  /**
   * Salt for the password
   */
  salt?: string;
}

/**
 * Ensure a static authentication
 *
 * It could add support for multi-user, htpasswd files or more based on user needs
 */
export class StaticAuthFilter extends SmtpFilter<StaticAuthConfiguration> {
  type: string = "static-auth";

  /**
   * @override
   */
  init() {
    this.config.username ??= process.env.SMTP_USERNAME;
    this.config.password ??= process.env.SMTP_PASSWORD;
    this.config.salt ??= process.env.SMTP_PASSWORD_SALT;
    if (this.config.username === undefined || this.config.password === undefined) {
      throw new Error("static-auth filter requires to have authentication defined");
    }
    const info = this.config.password.split(":");
    if (info[0] !== "plain" && !crypto.getHashes().includes(info[0])) {
      throw new Error(
        `static-auth do not recognize hash\nValid options: ${["plain", ...crypto.getHashes()].join(",")}`
      );
    }
  }

  /**
   * Validate a user is correct
   * @param auth
   * @param session
   * @returns
   */
  async onAuth(auth: SMTPServerAuthentication): Promise<boolean | undefined> {
    if (
      auth.method !== "XOAUTH2" &&
      this.validatePassword(<string>auth.password) &&
      auth.username === this.config.username
    ) {
      return true;
    }
    return false;
  }

  /**
   * Validate a password
   * @param password
   * @returns
   */
  validatePassword(password: string): boolean {
    const info = this.config.password.split(":");
    if (info[0] === "plain") {
      return info[1] === password;
    } else if (this.config.salt) {
      return crypto.createHmac(info[0], this.config.salt).update(password).digest("hex") === info[1];
    } else {
      return crypto.createHash(info[0]).update(password).digest("hex") === info[1];
    }
  }
}
