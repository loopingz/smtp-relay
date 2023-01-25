import { WorkerOutput } from "@webda/workout";
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

  constructor(public flow: SmtpFlow, public config: T, public logger: WorkerOutput) {
    this.name = config.name;
    this.init();
  }

  init() {
    this.name ??= this.config.type;
  }
}
