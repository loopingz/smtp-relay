import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { createHmac } from "crypto";
import * as http from "http";
import { SmtpFlow } from "../flow.js";
import { HttpAuthFilter, jsonPathValue, request } from "./http-auth.js";

@suite
class HttpAuthSmtpServerTest {
  server: any;
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

@suite
class HttpAuthRequestTest {
  server: any;
  received: { method?: string; headers: http.IncomingHttpHeaders; body: string }[] = [];

  before() {
    this.received = [];
    this.server = http
      .createServer((req, res) => {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", () => {
          this.received.push({ method: req.method, headers: req.headers, body });
          res.writeHead(200);
          res.end();
        });
      })
      .listen(16662);
  }

  after() {
    this.server?.close();
  }

  @test
  async "request defaults headers and method when signing"() {
    // No headers and no method provided: both fallbacks are exercised
    await request(<any>{ url: "http://localhost:16662", hmac: { secret: "s3cret" } });
    assert.strictEqual(this.received.length, 1);
    const sent = this.received[0];
    assert.strictEqual(sent.method, "GET", "method defaults to GET");
    // Defaults applied by request()
    assert.ok(sent.headers["x-smtp-relay-time"], "timestamp header is added");
    assert.ok(sent.headers["x-smtp-relay"], "default hmac header name is used");
  }

  @test
  async "request signs the body when one is provided"() {
    await request(<any>{ url: "http://localhost:16662", method: "POST", body: "payload", hmac: { secret: "s3cret" } });
    const sent = this.received[0];
    assert.strictEqual(sent.method, "POST");
    assert.strictEqual(sent.body, "payload");
    const signature = sent.headers["x-smtp-relay"] as string;
    const expected = createHmac("sha256", "s3cret")
      .update(["http://localhost:16662", "POST", sent.headers["x-smtp-relay-time"] as string, "payload"].join("\n"))
      .digest("hex");
    assert.strictEqual(signature, expected, "signature covers url, method, timestamp and body");
  }

  @test
  async "init defaults method to POST for non BASIC_AUTH"() {
    const logger = new WorkerOutput();
    const flow = new SmtpFlow("test", { outputs: [] }, logger);
    for (const credentialsMethod of ["FORM_URLENCODED", "JSON"] as const) {
      const filter = new HttpAuthFilter(
        flow,
        { type: "http-auth", url: "http://localhost:16662", credentialsMethod },
        logger
      );
      assert.strictEqual(filter.config.method, "POST", `${credentialsMethod} defaults to POST`);
    }
    // BASIC_AUTH keeps GET
    const basic = new HttpAuthFilter(flow, <any>{ type: "http-auth", url: "http://localhost:16662" }, logger);
    assert.strictEqual(basic.config.method, "GET");
  }

  @test
  async "form urlencoded tolerates missing credentials"() {
    const logger = new WorkerOutput();
    const flow = new SmtpFlow("test", { outputs: [] }, logger);
    const filter = new HttpAuthFilter(
      flow,
      { type: "http-auth", url: "http://localhost:16662", credentialsMethod: "FORM_URLENCODED" },
      logger
    );
    await filter.onAuth(<any>{ method: "LOGIN", validatePassword: () => false });
    assert.strictEqual(this.received[0].body, "username=&password=", "missing username/password encode as empty");
  }

  @test
  async "json auth falls back to default field paths"() {
    const logger = new WorkerOutput();
    const flow = new SmtpFlow("test", { outputs: [] }, logger);
    const filter = new HttpAuthFilter(
      flow,
      { type: "http-auth", url: "http://localhost:16662", credentialsMethod: "JSON" },
      logger
    );
    // Drop the defaults applied by init() to exercise the inline fallbacks
    delete filter.config.userField;
    delete filter.config.passwordField;
    await filter.onAuth(<any>{ method: "LOGIN", username: "bob", validatePassword: () => false });
    assert.deepStrictEqual(JSON.parse(this.received[0].body), { username: "bob", password: "" });
  }
}

@suite
class JsonPathValueTest {
  @test
  "should read simple property"() {
    const obj = { name: "John", age: 30 };
    assert.strictEqual(jsonPathValue(obj, "name"), "John");
    assert.strictEqual(jsonPathValue(obj, "age"), 30);
  }

  @test
  "should read nested property"() {
    const obj = { user: { name: "John", address: { city: "Paris" } } };
    assert.strictEqual(jsonPathValue(obj, "user.name"), "John");
    assert.strictEqual(jsonPathValue(obj, "user.address.city"), "Paris");
  }

  @test
  "should handle $. prefix"() {
    const obj = { user: { name: "John" } };
    assert.strictEqual(jsonPathValue(obj, "$.user.name"), "John");
    assert.strictEqual(jsonPathValue(obj, "user.name"), "John");
  }

  @test
  "should return undefined for non-existent property"() {
    const obj = { name: "John" };
    assert.strictEqual(jsonPathValue(obj, "nonexistent"), undefined);
    assert.strictEqual(jsonPathValue(obj, "user.name"), undefined);
  }

  @test
  "should set simple property"() {
    const obj = {};
    jsonPathValue(obj, "name", "John");
    assert.deepStrictEqual(obj, { name: "John" });
  }

  @test
  "should set nested property and create intermediate objects"() {
    const obj = {};
    jsonPathValue(obj, "user.name", "John");
    assert.deepStrictEqual(obj, { user: { name: "John" } });
  }

  @test
  "should set deeply nested property"() {
    const obj = {};
    jsonPathValue(obj, "user.address.city", "Paris");
    assert.deepStrictEqual(obj, { user: { address: { city: "Paris" } } });
  }

  @test
  "should set property with $. prefix"() {
    const obj = {};
    jsonPathValue(obj, "$.user.name", "John");
    assert.deepStrictEqual(obj, { user: { name: "John" } });
  }

  @test
  "should update existing property"() {
    const obj = { name: "John" };
    jsonPathValue(obj, "name", "Jane");
    assert.deepStrictEqual(obj, { name: "Jane" });
  }

  @test
  "should set property in existing nested object"() {
    const obj = { user: { age: 30 } };
    jsonPathValue(obj, "user.name", "John");
    assert.deepStrictEqual(obj, { user: { age: 30, name: "John" } });
  }

  @test
  "should handle empty object"() {
    const obj = {};
    assert.strictEqual(jsonPathValue(obj, "name"), undefined);
    jsonPathValue(obj, "name", "value");
    assert.strictEqual(jsonPathValue(obj, "name"), "value");
  }

  @test
  "should handle root level property"() {
    const obj = { root: "value" };
    assert.strictEqual(jsonPathValue(obj, "root"), "value");
    jsonPathValue(obj, "root", "newValue");
    assert.strictEqual(jsonPathValue(obj, "root"), "newValue");
  }

  @test
  "should create multiple levels at once"() {
    const obj = {};
    jsonPathValue(obj, "a.b.c.d.e", "deep");
    assert.strictEqual(jsonPathValue(obj, "a.b.c.d.e"), "deep");
    assert.deepStrictEqual(obj, { a: { b: { c: { d: { e: "deep" } } } } });
  }

  @test
  "should block unsafe keys to prevent prototype pollution"() {
    for (const key of ["__proto__", "prototype", "constructor"]) {
      // Reading through an unsafe key is refused
      assert.strictEqual(jsonPathValue({}, key), undefined, `read ${key}`);
      assert.strictEqual(jsonPathValue({}, `a.${key}.b`), undefined, `read a.${key}.b`);
      // Writing through an unsafe key is refused and leaves the prototype intact
      const obj: any = {};
      assert.strictEqual(jsonPathValue(obj, `${key}.polluted`, "yes"), undefined, `write ${key}`);
      assert.deepStrictEqual(obj, {}, `${key} must not mutate the target`);
      assert.strictEqual(({} as any).polluted, undefined, `${key} must not pollute Object.prototype`);
    }
  }

  @test
  "should not traverse through a non-object intermediate value"() {
    // "a" resolves to a primitive, so the nested object cannot be created
    assert.strictEqual(jsonPathValue({ a: "str" }, "a.b.c", "value"), undefined);
    assert.strictEqual(jsonPathValue({ a: 42 }, "a.b.c", "value"), undefined);
    assert.strictEqual(jsonPathValue({ a: true }, "a.b.c", "value"), undefined);
    // null intermediates are refused rather than throwing a TypeError
    assert.strictEqual(jsonPathValue({ a: null }, "a.b.c", "value"), undefined);
    assert.strictEqual(jsonPathValue({ a: null }, "a.b.c"), undefined);
  }
}
