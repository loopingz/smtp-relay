import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import * as http from "http";
import { SmtpFlow } from "../flow";
import { HttpAuthFilter } from "./http-auth";

@suite
class HttpAuthSmtpServerTest {
  server;
  jsonpath: boolean = false;

  before() {
    this.server = http
      .createServer((req, res) => {
        if (req.headers["authorization"]) {
          res.setHeader("X-TEST-AUTH", "BasicAuth");
          if (req.headers["authorization"] === "Basic dGVzdDpwbG9wMg==") {
            res.writeHead(200);
          } else {
            res.writeHead(401);
          }
          res.end();
          return;
        }
        if (req.method === "GET") {
          res.writeHead(401);
          res.end();
        }
        let body = "";
        req.on("data", chunk => {
          body += chunk;
        });
        req.on("end", () => {
          body = body.trim();
          if (req.headers["content-type"] === "application/x-www-form-urlencoded") {
            if (body === "username=test%C3%A9&password=plop%26ok") {
              res.writeHead(200);
            } else {
              res.writeHead(401);
            }
          } else if (req.headers["content-type"] === "application/json") {
            let info = JSON.parse(body);
            if (!this.jsonpath) {
              if (info.username === "plop" && info.password === "test") {
                res.writeHead(200);
              } else {
                res.writeHead(401);
              }
            } else {
              let result;
              if (info.username === "plop" && info.password === "test") {
                result = JSON.stringify({ result: "OK" });
              } else {
                result = JSON.stringify({ result: "NOK" });
              }
              res.write(result);
            }
          }
          res.end();
        });
      })
      .listen(16661);
  }

  async after() {
    await this.server.close();
  }

  @test
  async cov() {
    try {
      const logger = new WorkerOutput();
      const flow = new SmtpFlow("test", { outputs: [] }, logger);
      let filter: HttpAuthFilter;
      assert.throws(
        () => new HttpAuthFilter(flow, <any>{ type: "http-auth" }, logger),
        /http-auth filter requires an url/
      );
      assert.throws(
        () =>
          new HttpAuthFilter(
            flow,
            { type: "http-auth", url: "", credentialsMethod: "FORM_URLENCODED", method: "GET" },
            logger
          ),
        /http-auth filter cannot use GET method with other than BASIC_AUTH/
      );
      filter = new HttpAuthFilter(flow, <any>{ type: "http-auth", url: "http://localhost:16661" }, logger);
      assert.ok(
        !(await filter.onAuth({ method: "LOGIN", username: "test", password: "plop", validatePassword: () => false }))
      );
      assert.ok(
        await filter.onAuth({ method: "LOGIN", username: "test", password: "plop2", validatePassword: () => false })
      );
      filter.config.credentialsMethod = "FORM_URLENCODED";
      filter.config.method = "POST";
      filter.init();
      assert.ok(
        !(await filter.onAuth({ method: "LOGIN", username: "testé", password: "plopé", validatePassword: () => false }))
      );
      assert.ok(
        await filter.onAuth({ method: "LOGIN", username: "testé", password: "plop&ok", validatePassword: () => false })
      );
      filter.config.credentialsMethod = "JSON";
      delete filter.config.userField;
      delete filter.config.passwordField;
      filter.init();
      filter.config.hmac = {
        secret: "mysignature"
      };
      this.jsonpath = false;
      assert.ok(
        !(await filter.onAuth({ method: "LOGIN", username: "test", password: "plop", validatePassword: () => false })),
        "Should refuse the request"
      );
      assert.ok(
        await filter.onAuth({ method: "LOGIN", username: "plop", password: "test", validatePassword: () => false }),
        "Should accept the request"
      );
      this.jsonpath = true;
      filter.config.json_result = {
        path: "$.result",
        value: "OK"
      };
      assert.ok(
        !(await filter.onAuth({ method: "LOGIN", username: "test", password: "plop", validatePassword: () => false })),
        "Should refuse the request"
      );
      assert.ok(
        await filter.onAuth({ method: "LOGIN", username: "plop", password: "test", validatePassword: () => false }),
        "Should accept the request"
      );
    } finally {
      await this.server?.close();
    }
  }
}
