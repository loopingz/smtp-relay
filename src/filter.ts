import { SmtpFlow } from "./flow";
import { SmtpProcessorConfig } from "./processor";
import { SmtpAddress, SmtpAuth, SmtpSession } from "./server";

export interface SmtpFilterConfig {
  name?: string;
  type: string;
}
export class SmtpFilter<T extends SmtpFilterConfig = SmtpFilterConfig> {
  name: string;
  flow: SmtpFlow;
  config: T;

  constructor(flow: SmtpFlow, config: T) {
    this.name = config.name;
    this.config = config;
    this.flow = flow;
  }

  async onAuth(auth: SmtpAuth, session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  async onConnect(session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  onMailFrom(address: SmtpAddress, session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  onRcptTo(address: SmtpAddress, session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }
  onData(session: SmtpSession): Promise<boolean | undefined> {
    return undefined;
  }

  static registry = {};

  static register(type: string, constructor) {
    SmtpFilter.registry[type] = constructor;
  }

  static get(flow: SmtpFlow, config: SmtpProcessorConfig): SmtpFilter {
    return new SmtpFilter.registry[config.type](flow, config);
  }

  getState(session: SmtpSession) {
    return session[`${this.flow.name}_${this.name}`];
  }

  setState(session: SmtpSession, state: any) {
    session[`${this.flow.name}_${this.name}`] = state;
  }
}
