import { SmtpFlow } from "./flow";

/**
 * Define a component and its type
 */
export interface SmtpComponentConfig {
  name?: string;
  type: string;
}

export class SmtpComponent<T extends SmtpComponentConfig = SmtpComponentConfig> {
  name: string;
  flow: SmtpFlow;
  config: T;

  constructor(flow: SmtpFlow, config: T) {
    this.name = config.name;
    this.config = config;
    this.flow = flow;
    this.init();
  }

  init() {
    this.name ??= this.config.type;
  }
}
