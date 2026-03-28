import { WorkerOutput } from "@webda/workout";
import { SMTPServerAddress, SMTPServerAuthentication } from "smtp-server";
import { SmtpComponent, SmtpComponentConfig } from "./component";
import { SmtpFlow } from "./flow";
import { SmtpSession } from "./server";

export class SmtpFilter<T extends SmtpComponentConfig = SmtpComponentConfig> extends SmtpComponent<T> {
  declare name: string;
  declare flow: SmtpFlow;
  declare config: T;
  declare logger: WorkerOutput;

  async onAuth(_auth: SMTPServerAuthentication, _session: SmtpSession, _flow?: string): Promise<boolean | undefined> {
    return undefined;
  }
  async onConnect(_session: SmtpSession, _flow?: string): Promise<boolean | undefined> {
    return undefined;
  }
  async onMailFrom(_address: SMTPServerAddress, _session: SmtpSession, _flow?: string): Promise<boolean | undefined> {
    return undefined;
  }
  async onRcptTo(_address: SMTPServerAddress, _session: SmtpSession, _flow?: string): Promise<boolean | undefined> {
    return undefined;
  }
  async onData(_session: SmtpSession, _flow?: string): Promise<boolean | undefined> {
    return undefined;
  }

  static registry: { [key: string]: new (...args: any[]) => SmtpFilter } = {};

  static register(type: string, constructor: new (...args: any[]) => SmtpFilter) {
    SmtpFilter.registry[type] = constructor;
  }

  static get(flow: SmtpFlow, config: SmtpComponentConfig): SmtpFilter {
    if (!SmtpFilter.registry[config.type]) {
      throw new Error(`${config.type} is an unknown filter type`);
    }
    return new SmtpFilter.registry[config.type](flow, config, flow.logger);
  }

  getState(session: SmtpSession & { [key: string]: any }) {
    return session[`${this.flow.name}_${this.name}`];
  }

  setState(session: SmtpSession & { [key: string]: any }, state: any) {
    session[`${this.flow.name}_${this.name}`] = state;
  }
}
