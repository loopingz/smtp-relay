import { createHmac } from "crypto";
import * as jsonpath from "jsonpath";
import { SMTPServerAuthentication } from "smtp-server";
import { SmtpFilter } from "../filter";
import { HttpConfig } from "./http-filter";
const jp = jsonpath.default;

/**
 * Expose the fetch api (node>18) and add hmac signature
 * @param options
 * @returns
 */
export async function request(options: RequestInit & HttpConfig) {
  options.headers ??= {};
  if (options.hmac) {
    options.hmac.algo ??= "sha256";
    options.hmac.header ??= "X-SMTP-RELAY";
    options.headers["X-SMTP-RELAY-TIME"] = Date.now();
    const data = [options.url, options.method, options.headers["X-SMTP-RELAY-TIME"]];
    if (options.body) {
      data.push(options.body);
    }
    options.headers[options.hmac.header] = createHmac(options.hmac.algo, options.hmac.secret)
      .update(data.join("\n"))
      .digest("hex");
  }
  return fetch(options.url, options);
}

export interface HttpAuthConfig extends HttpConfig {
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
        body: `${this.config.userField}=${encodeURIComponent(auth.username)}&${
          this.config.passwordField
        }=${encodeURIComponent(auth.password)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      return res.ok;
    } else if (this.config.credentialsMethod === "JSON") {
      const data = {};
      jp.value(data, this.config.userField || "$.username", auth.username);
      jp.value(data, this.config.passwordField || "$.password", auth.password);
      const res = await request({
        ...this.config,
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      // If jsonpath is defined then we parse the answer
      if (this.config.json_result && res.ok) {
        if (jp.value(await res.json(), this.config.json_result.path) === this.config.json_result.value) {
          return true;
        }
        return false;
      } else {
        return res.ok;
      }
    }
  }
}
