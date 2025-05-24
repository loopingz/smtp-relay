import { SmtpFilter } from "../filter"; // Import base SmtpFilter

// Import all filter implementations
import { WhitelistFilter } from "./whitelist";
import { StaticAuthFilter } from "./static-auth";
import { HttpAuthFilter } from "./http-auth";
import { HttpFilter } from "./http-filter";
import { AuthFilter } from "./auth";

export function registerAllFilters() {
  SmtpFilter.register("whitelist", WhitelistFilter);
  SmtpFilter.register("static-auth", StaticAuthFilter);
  SmtpFilter.register("http-auth", HttpAuthFilter);
  SmtpFilter.register("http-filter", HttpFilter);
  SmtpFilter.register("auth", AuthFilter);
  // console.log("All filters registered from src/filters/index.ts");
}
