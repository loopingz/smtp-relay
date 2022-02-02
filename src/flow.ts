import { SmtpFilter } from "./filter";
import { SmtpProcessor, SmtpProcessorConfig } from "./processor";

export interface SmtpFlowConfig {
  filters?: SmtpProcessorConfig[];
  filtersOperator?: "AND" | "OR";
  outputs: SmtpProcessorConfig[];
}

export class SmtpFlow {
  config: SmtpFlowConfig;
  filters: SmtpFilter[];
  outputs: SmtpProcessor[];
  name: string;

  constructor(name: string, config: SmtpFlowConfig) {
    this.name = name;
    this.config = config;
    config.filters ??= [];
    config.outputs ??= [];
    this.filters = config.filters.map((f, i) => SmtpFilter.get(this, { ...f, name: f.name || `${f.type}_${i}` }));
    this.outputs = config.outputs.map((f, i) => SmtpProcessor.get(this, { ...f, name: f.name || `${f.type}_${i}` }));
  }
}
