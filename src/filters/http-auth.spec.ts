import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import * as http from "http";
import { SmtpFlow } from "../flow";
import { HttpAuthFilter, jsonPathValue, validateUrl } from "./http-auth";

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
      filter = new HttpAuthFilter(
        flow,
        <any>{ type: "http-auth", url: "http://localhost:16661", allowPrivateUrls: true },
        logger
      );
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
}

@suite
class ValidateUrlTest {
  @test
  "should allow public HTTP URLs"() {
    assert.doesNotThrow(() => validateUrl("http://example.com/api"));
    assert.doesNotThrow(() => validateUrl("https://example.com/api"));
  }

  @test
  "should block non-HTTP protocols"() {
    assert.throws(() => validateUrl("ftp://example.com"), /SSRF protection: protocol/);
    assert.throws(() => validateUrl("file:///etc/passwd"), /SSRF protection: protocol/);
    assert.throws(() => validateUrl("gopher://example.com"), /SSRF protection: protocol/);
  }

  @test
  "should block localhost"() {
    assert.throws(() => validateUrl("http://localhost"), /SSRF protection: hostname/);
    assert.throws(() => validateUrl("http://localhost:8080"), /SSRF protection: hostname/);
  }

  @test
  "should block loopback and private IPs"() {
    assert.throws(() => validateUrl("http://127.0.0.1"), /SSRF protection: private IP/);
    assert.throws(() => validateUrl("http://10.0.0.1"), /SSRF protection: private IP/);
    assert.throws(() => validateUrl("http://172.16.0.1"), /SSRF protection: private IP/);
    assert.throws(() => validateUrl("http://172.31.255.255"), /SSRF protection: private IP/);
    assert.throws(() => validateUrl("http://192.168.1.1"), /SSRF protection: private IP/);
    assert.throws(() => validateUrl("http://169.254.169.254"), /SSRF protection: private IP/);
    assert.throws(() => validateUrl("http://0.0.0.0"), /SSRF protection: hostname/);
  }

  @test
  "should block IPv6 loopback"() {
    assert.throws(() => validateUrl("http://[::1]"), /SSRF protection: hostname/);
  }

  @test
  "should allow non-private IPs"() {
    assert.doesNotThrow(() => validateUrl("http://8.8.8.8"));
    assert.doesNotThrow(() => validateUrl("http://172.32.0.1"));
    assert.doesNotThrow(() => validateUrl("http://172.15.0.1"));
  }
}
