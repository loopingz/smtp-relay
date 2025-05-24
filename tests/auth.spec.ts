import { suite, test, timeout } from "@testdeck/mocha";
import * as assert from "assert";
import { SmtpServer } from "../src/server";
import { SmtpTest } from "../src/server.spec";
import { defaultModules } from "../src";
import * as mailauth from "mailauth"; // To mock 'authenticate'
import sinon from "sinon";

const FROM_ADDRESS = "sender@example.com";
const TO_ADDRESS = "recipient@example.net";
const EMAIL_BODY = "Subject: Test Email\r\n\r\nThis is a test email.";
const CLIENT_HOSTNAME = "client.example.org";
const CLIENT_IP = "1.2.3.4";

@suite
@timeout(6000) // Increase timeout for server start/stop and email sending
class AuthFilterSmtpServerTest {
  private server: SmtpServer | null = null;
  private smtpTest: SmtpTest = new SmtpTest(CLIENT_IP, CLIENT_HOSTNAME); // Pass client IP and hostname
  private authStub: sinon.SinonStub | null = null;

  before() {
    defaultModules(); // Ensure AuthFilter is registered
  }

  afterEach(done) {
    this.authStub?.restore();
    if (this.server) {
      this.server.close(() => {
        this.server = null;
        done(); // Ensure server is closed before next test
      });
    } else {
      done();
    }
  }

  private async setupServer(configPath: string): Promise<void> {
    this.server = new SmtpServer(configPath);
    this.server.init();
    // Short delay to ensure server is ready, adjust if needed
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // --- Test Cases ---

  @test
  async "DKIM Fail, Policy Reject: Email should be rejected"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "fail", comment: "DKIM verification failed" } }] },
      spf: { status: { result: "pass" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=fail; spf=pass"
    } as mailauth.AuthResults);

    await this.setupServer("./tests/auth-reject-fail.json");
    try {
      await this.smtpTest.failEmail("DATA", FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY, "550 5.7.24 DKIM check failed: DKIM verification failed");
      done();
    } catch (e) {
      done(e);
    }
  }

  @test
  async "SPF Fail, Policy Reject: Email should be rejected"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "pass" } }] },
      spf: { status: { result: "fail", comment: "SPF verification failed" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=pass; spf=fail"
    } as mailauth.AuthResults);
    
    await this.setupServer("./tests/auth-reject-fail.json");
    try {
      await this.smtpTest.failEmail("DATA", FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY, "550 5.7.23 SPF check failed: SPF verification failed");
      done();
    } catch (e) {
      done(e);
    }
  }

  @test
  async "DKIM Fail, Policy Tag: Email should be accepted"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "fail", comment: "DKIM verification failed (tag)" } }] },
      spf: { status: { result: "pass" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=fail (tag); spf=pass"
    } as mailauth.AuthResults);

    await this.setupServer("./tests/auth-tag-fail.json");
    try {
      await this.smtpTest.sendEmail(FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY);
      // TODO: Check logs or modified headers if possible to verify "tagging" action
      done();
    } catch (e) {
      done(e);
    }
  }

  @test
  async "SPF Fail, Policy Tag: Email should be accepted"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "pass" } }] },
      spf: { status: { result: "fail", comment: "SPF verification failed (tag)" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=pass; spf=fail (tag)"
    } as mailauth.AuthResults);

    await this.setupServer("./tests/auth-tag-fail.json");
    try {
      await this.smtpTest.sendEmail(FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY);
      // TODO: Check logs or modified headers
      done();
    } catch (e) {
      done(e);
    }
  }
  
  @test
  async "DKIM & SPF Fail, Policy Accept: Email should be accepted"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "fail", comment: "DKIM verification failed (accept)" } }] },
      spf: { status: { result: "fail", comment: "SPF verification failed (accept)" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=fail; spf=fail"
    } as mailauth.AuthResults);

    await this.setupServer("./tests/auth-accept-fail.json");
    try {
      await this.smtpTest.sendEmail(FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY);
      done();
    } catch (e) {
      done(e);
    }
  }

  @test
  async "DKIM & SPF Pass, Policy Reject: Email should be accepted"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "pass" } }] },
      spf: { status: { result: "pass" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=pass; spf=pass"
    } as mailauth.AuthResults);

    await this.setupServer("./tests/auth-reject-fail.json"); // Configured to reject on fail
    try {
      await this.smtpTest.sendEmail(FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY); // Should be accepted as auth passes
      done();
    } catch (e) {
      done(e);
    }
  }
  
  @test
  async "Mailauth Error, Policy Reject: Email should be accepted (default fallback)"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").rejects(new Error("Internal mailauth error"));

    await this.setupServer("./tests/auth-reject-fail.json");
    try {
      await this.smtpTest.sendEmail(FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY);
      // Current AuthFilter behavior is to accept on internal error
      done();
    } catch (e) {
      done(e);
    }
  }

   @test
  async "No Auth Results (neutral/none), Policy Reject: Email should be accepted"(done) {
    this.authStub = sinon.stub(mailauth, "authenticate").resolves({
      dkim: { results: [{ status: { result: "none", comment: "No DKIM signature" } }] },
      spf: { status: { result: "neutral", comment: "SPF neutral" } },
      headers: "Authentication-Results: test-mta.example.com; dkim=none; spf=neutral"
    } as mailauth.AuthResults);

    await this.setupServer("./tests/auth-reject-fail.json"); // Configured to reject on fail
    try {
      // Should be accepted as 'none' and 'neutral' are not considered hard fails by AuthFilter's policy logic
      await this.smtpTest.sendEmail(FROM_ADDRESS, TO_ADDRESS, EMAIL_BODY);
      done();
    } catch (e) {
      done(e);
    }
  }
}
