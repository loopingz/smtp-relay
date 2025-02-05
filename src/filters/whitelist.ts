import { SMTPServerAddress } from "smtp-server";
import { SmtpComponentConfig } from "../component";
import { SmtpFilter } from "../filter";
import { SmtpSession } from "../server";
import { createChecker } from "is-in-subnet";

export interface WhitelistFilterConfiguration extends SmtpComponentConfig {
  type: "whitelist";
  from?: (string | RegExp)[];
  to?: (string | RegExp)[];
  ips?: (string | RegExp)[];
  domains?: (string | RegExp)[];
  subnets?: string[];
}

/**
 * Whitelist Ips, domains, senders or recipients
 */
export class WhitelistFilter extends SmtpFilter<WhitelistFilterConfiguration> {
  type: string = "whitelist";
  subnetChecker?: (ip: string) => boolean;

  init() {
    // Ensure regexps do not allow any partial match
    ["from", "to", "ips", "domains"]
      .filter(a => this.config[a])
      .forEach(attr => {
        this.config[attr] = this.config[attr].map(r => this.getRegExp(r));
      });
    if (this.config.subnets) {
      this.subnetChecker = createChecker(this.config.subnets);
    }
  }
  /**
   * Filter on sender
   * @param account
   * @returns
   */
  async onMailFrom(account: SMTPServerAddress) {
    return this.check("from", account.address);
  }

  /**
   * Avoid regexp to have partial match
   * @param reg
   */
  getRegExp(reg: string): RegExp | string {
    if (!reg.startsWith("regexp:")) {
      return reg;
    }
    reg = reg.substring(7);
    if (!reg.startsWith("^")) {
      reg = "^" + reg;
    }
    if (!reg.endsWith("$")) {
      reg += "$";
    }
    return new RegExp(reg);
  }

  /**
   * Check if we have condition on the field and return if the value
   * match any of the regexp configured
   *
   * @param attr
   * @param value
   * @returns
   */
  check(attr: "to" | "from" | "ips" | "domains", value: string) {
    if (this.config[attr]) {
      for (let f of this.config[attr]) {
        if (typeof f === "string") {
          if (f === value) {
            return true;
          }
        } else if (f instanceof RegExp && f.exec(value)) {
          return true;
        }
      }
      return false;
    }
    return undefined;
  }

  /**
   * Filter on IPS and Domains with a "OR"
   *
   * @param session
   * @returns
   */
  async onConnect(session: SmtpSession) {
    let ip = this.check("ips", session.remoteAddress);
    let domain = this.check("domains", session.clientHostname);
    if (this.subnetChecker) {
      ip ??= false;
      ip ||= this.subnetChecker(session.remoteAddress);
    }
    if (ip === undefined && domain === undefined) {
      return undefined;
    }
    domain ??= false;
    ip ??= false;
    return ip || domain;
  }

  /**
   * Filter on receptient
   * @param account
   * @returns
   */
  async onRcptTo(account: SMTPServerAddress) {
    return this.check("to", account.address);
  }
}
