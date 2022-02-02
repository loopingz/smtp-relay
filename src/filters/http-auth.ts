import { SmtpFilter, SmtpFilterConfig } from "../filter";

export interface HttpFilterConfig extends SmtpFilterConfig {
  url: string;
  method?: "PUT" | "POST";
  /**
   * If not define the HTTP code is used
   * < 300: Allowed
   * >= 300: Refused
   */
  jsonpath?: string;
}
export class HttpFilter extends SmtpFilter<HttpFilterConfig> {
  type: string = "http-auth";

  async onMailFrom(account) {
    return undefined;
  }

  async onConnect() {
    return undefined;
  }

  async onRcptTo() {
    // Send the information for validation
    return false;
  }
}
