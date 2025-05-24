import { WorkerOutput } from "@webda/workout";
import { SMTPServerAddress, SMTPServerAuthentication } from "smtp-server";
import { SmtpComponent, SmtpComponentConfig } from "./component";
import { SmtpFlow } from "./flow";
import { SmtpSession } from "./server";

export class SmtpFilter<T extends SmtpComponentConfig = SmtpComponentConfig> extends SmtpComponent<T> {
  name: string;
  flow: SmtpFlow;
  config: T;
  logger: WorkerOutput;

  async onAuth(_auth: SMTPServerAuthentication, _session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  async onConnect(_session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  onMailFrom(_address: SMTPServerAddress, _session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  onRcptTo(_address: SMTPServerAddress, _session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  onData(_session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }

  static registry = {};

  static register(type: string, constructor) {
    SmtpFilter.registry[type] = constructor;
  }

  static get(flow: SmtpFlow, config: SmtpComponentConfig): SmtpFilter {
    if (!SmtpFilter.registry[config.type]) {
      throw new Error(`${config.type} is an unknown filter type`);
    }
    return new SmtpFilter.registry[config.type](flow, config, flow.logger);
  }

  getState(session: SmtpSession) {
    return session[`${this.flow.name}_${this.name}`];
  }

  setState(session: SmtpSession, state: any) {
    session[`${this.flow.name}_${this.name}`] = state;
  }
}

// Import and register filters
import { WhitelistFilter } from "./filters/whitelist";
import { StaticAuthFilter } from "./filters/static-auth";
import { HttpAuthFilter } from "./filters/http-auth";
import { HttpFilter } from "./filters/http-filter";
import { AuthFilter } from "./filters/auth"; // Import the new AuthFilter

SmtpFilter.register("whitelist", WhitelistFilter);
SmtpFilter.register("static-auth", StaticAuthFilter);
SmtpFilter.register("http-auth", HttpAuthFilter);
SmtpFilter.register("http-filter", HttpFilter);
SmtpFilter.register("auth", AuthFilter); // Register the new AuthFilter
