import { createHmac } from "crypto";
import { SMTPServerAuthentication } from "smtp-server";
import { SmtpFilter } from "../filter";
import { HttpConfig } from "./http-filter";

/**
 * Validate URL to prevent SSRF attacks
 * Blocks private/internal addresses and non-HTTP protocols
 */
export function validateUrl(urlStr: string) {
  const url = new URL(urlStr);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`SSRF protection: protocol '${url.protocol}' is not allowed, only http: and https:`);
  }
  const hostname = url.hostname.toLowerCase();
  // Block obvious localhost variants
  if (hostname === "localhost" || hostname === "[::1]" || hostname === "0.0.0.0") {
    throw new Error(`SSRF protection: hostname '${hostname}' is not allowed`);
  }
  // Block private IPv4 ranges
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (
      a === 127 || // 127.0.0.0/8
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local / cloud metadata)
      a === 0 // 0.0.0.0/8
    ) {
      throw new Error(`SSRF protection: private IP '${hostname}' is not allowed`);
    }
  }
}

/**
 * Expose the fetch api (node>18) and add hmac signature
 * @param options
 * @returns
 */
export async function request(options: RequestInit & HttpConfig) {
  const headers: Record<string, string | number> = (options.headers ?? {}) as Record<string, string | number>;
  if (options.hmac) {
    options.hmac.algo ??= "sha256";
    options.hmac.header ??= "X-SMTP-RELAY";
    headers["X-SMTP-RELAY-TIME"] = Date.now();
    const data: (string | number)[] = [options.url, options.method ?? "GET", headers["X-SMTP-RELAY-TIME"]];
    if (options.body) {
      data.push(options.body as string);
    }
    headers[options.hmac.header] = createHmac(options.hmac.algo, options.hmac.secret)
      .update(data.join("\n"))
      .digest("hex");
  }
  options.headers = headers as any;
  return fetch(options.url, options);
}

export function jsonPathValue(object: any, path: string, value?: string) {
  if (path.startsWith("$.")) {
    path = path.substring(2);
  }
  const parts = path.split(".");
  let current = object;
  const isUnsafeKey = (key: string) =>
    key === "__proto__" || key === "prototype" || key === "constructor";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Prevent prototype pollution by blocking unsafe keys
    if (isUnsafeKey(part)) {
      return undefined;
    }
    if (i === parts.length - 1 && value !== undefined) {
      current[part] = value;
      return;
    }
    if (current[part] === undefined) {
      if (value !== undefined) {
        // Only create nested objects when the current value is an object
        if (current !== null && typeof current === "object") {
          current[part] = {};
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    current = current[part];
  }
  return current;
}

export interface HttpAuthConfig extends HttpConfig {
  type: "http-auth";
  /**
   * URL to call
   */
  url: string;
  /**
   * Method to use
   */
  method?: "PUT" | "POST" | "GET";
  /**
   * If not define the HTTP code is used:
   * < 300: Allowed
   * >= 300: Refused
   *
   * If defined the response is read as JSON and test for value
   */
  json_result?: {
    /**
     * Json path to read from the response
     */
    path: string;
    /**
     * Value to compare to, if equal then authentication is accepted
     */
    value: string;
  };
  /**
   * Http method to use to pass credentials
   *
   * BasicAuth: Will use the Authorization field
   * Json: Will post/put a JSON body with the user/password
   * FormData: Will post/put a Form body with the user/password
   */
  credentialsMethod: "BASIC_AUTH" | "JSON" | "FORM_URLENCODED";
  /**
   * Name of the field for FormData
   * Jsonpath for Json
   */
  userField?: string;
  /**
   * Name of the field for FormData
   * Jsonpath for Json
   */
  passwordField?: string;
}

/**
 *
 */
export class HttpAuthFilter extends SmtpFilter<HttpAuthConfig> {
  type: string = "http-auth";

  /**
   * @override
   */
  init() {
    if (this.config.url === undefined) {
      throw new Error("http-auth filter requires an url");
    }
    this.config.credentialsMethod ??= "BASIC_AUTH";
    if (this.config.credentialsMethod === "FORM_URLENCODED") {
      this.config.userField ??= "username";
      this.config.passwordField ??= "password";
    } else if (this.config.credentialsMethod === "JSON") {
      this.config.userField ??= "$.username";
      this.config.passwordField ??= "$.password";
    }
    this.config.method ??= this.config.credentialsMethod === "BASIC_AUTH" ? "GET" : "POST";
    if (this.config.credentialsMethod !== "BASIC_AUTH" && this.config.method === "GET") {
      throw new Error("http-auth filter cannot use GET method with other than BASIC_AUTH");
    }
    if (!this.config.allowPrivateUrls) {
      validateUrl(this.config.url);
    }
  }

  /**
   * Check based on http request
   * @param auth
   * @returns
   */
  async onAuth(auth: SMTPServerAuthentication): Promise<boolean | undefined> {
    if (this.config.credentialsMethod === "BASIC_AUTH") {
      const b64 = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      const res = await request({ ...this.config, headers: { Authorization: `Basic ${b64}` } });
      return res.ok;
    } else if (this.config.credentialsMethod === "FORM_URLENCODED") {
      // application/x-www-form-urlencoded
      const res = await request({
        ...this.config,
        body: `${this.config.userField!}=${encodeURIComponent(auth.username ?? "")}&${
          this.config.passwordField!
        }=${encodeURIComponent(auth.password ?? "")}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      return res.ok;
    } else if (this.config.credentialsMethod === "JSON") {
      const data = {};
      jsonPathValue(data, this.config.userField || "$.username", auth.username);
      jsonPathValue(data, this.config.passwordField || "$.password", auth.password ?? "");
      const res = await request({
        ...this.config,
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      // If jsonpath is defined then we parse the answer
      if (this.config.json_result && res.ok) {
        if (jsonPathValue(await res.json(), this.config.json_result.path) === this.config.json_result.value) {
          return true;
        }
        return false;
      } else {
        return res.ok;
      }
    }
  }
}
