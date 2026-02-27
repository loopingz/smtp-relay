import { suite, test } from "@testdeck/mocha";
import { WorkerOutput } from "@webda/workout";
import * as assert from "assert";
import { SmtpFlow } from "../flow";
import * as fs from "node:fs";
import { MailAuthFilter } from "./mail-auth";
import { getFakeSession } from "../server.spec";
import { generateKeyPairSync } from "node:crypto";
import { dkimSign } from "mailauth/lib/dkim/sign";

@suite
class MailAuthTest {
  @test
  async dnsMocked() {
    // SPF test
    const session = getFakeSession();
    const originalContent = fs.readFileSync(session.emailPath, "utf-8");
    try {
      // Save original dns.resolveTxt
      const logger = new WorkerOutput();
      const flow = new SmtpFlow("test", { outputs: [] }, logger);
      const zone = {};
      const mailauth = new MailAuthFilter(
        flow,
        {
          mailauth: {
            resolver: async (domain, type) => {
              console.log(`Resolving ${domain} ${type} ${zone[domain] ? zone[domain][type] : "not found"}`);
              if (zone[domain] && zone[domain][type]) {
                return zone[domain][type].map((record: string) => [record]);
              }
              return [];
            }
          }
        } as any,
        logger
      );
      // SPF test
      let filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(filterResult, "No protection should pass");
      mailauth.config.enforceDmarc = "v=DMARC1; p=reject";
      filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(!filterResult, "No protection but enforced dmarc should fail");
      delete mailauth.config.enforceDmarc;

      zone["test.com"] = {
        TXT: ["v=spf1 ip4:1.2.3.4 -all"]
      };
      // SPF without dmarc
      filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(filterResult, "SPF should pass");
      // Enforcing dmarc with failing SPF
      mailauth.config.enforceDmarc = "v=DMARC1; p=quarantine";
      filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(filterResult, "Dmarc should let pass with quarantine");
      mailauth.config.enforceDmarc = "v=DMARC1; p=reject";
      filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(!filterResult, "Dmarc should fail");
      delete mailauth.config.enforceDmarc;
      // Remove dmarc enforcement

      // Add dmarc now
      zone["_dmarc.test.com"] = {
        TXT: ["v=DMARC1; p=reject"]
      };
      filterResult = await mailauth.onData(session, "mailauth");
      assert.strictEqual(session.context.mailauth.dmarc.status.result, "fail", "DMARC should fail");
      assert.ok(!filterResult, "Dmarc should fail");
      zone["_dmarc.test.com"].TXT = ["v=DMARC1; p=quarantine"];
      filterResult = await mailauth.onData(session, "mailauth");
      assert.strictEqual(session.context.mailauth.dmarc.status.result, "fail", "DMARC should fail with quarantine");
      assert.ok(filterResult, "Dmarc should fail");
      zone["_dmarc.test.com"].TXT = ["v=DMARC1; p=none"];
      filterResult = await mailauth.onData(session, "mailauth");
      assert.strictEqual(session.context.mailauth.dmarc.status.result, "fail", "DMARC should fail with none");
      assert.ok(filterResult, "Dmarc should none");
      zone["_dmarc.test.com"].TXT = ["v=DMARC1; p=reject"];

      // Fix SPF
      zone["test.com"].TXT = ["v=spf1 ip4:127.0.0.1 -all"];
      filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(filterResult, "SPF should pass");
      let content = fs.readFileSync(session.emailPath, "utf-8");
      assert.ok(content.includes("Received-SPF:"), "Should have Received-SPF header");
      zone["test.com"].TXT = ["v=spf1 ip4:1.2.3.4 ~all"];
      //assert.ok(await mailauth.onData(session, "mailauth"), "SPF should pass with softfail");
      zone["test.com"].TXT = ["v=spf1 include:loopingz.com -all"];
      zone["loopingz.com"] = {
        TXT: ["v=spf1 ip4:127.0.0.1 -all"]
      };
      filterResult = await mailauth.onData(session, "mailauth");
      assert.ok(filterResult, "SPF should pass with include");

      // DKIM test
      const { publicKey, privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem"
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem"
        }
      });
      const { publicKey: publicKey2, privateKey: privateKey2 } = generateKeyPairSync("rsa", {
        modulusLength: 1024,
        publicKeyEncoding: {
          type: "spki",
          format: "pem"
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem"
        }
      });
      zone["key._domainkey.test.com"] = {
        TXT: [
          `v=DKIM1; k=rsa; p=${publicKey
            .split("\n")
            .filter(p => !p.startsWith("----"))
            .join("")}`
        ]
      };

      // DKIM signing
      fs.writeFileSync(session.emailPath, originalContent);
      let result = await dkimSign(fs.createReadStream(session.emailPath), {
        signatureData: [
          {
            selector: "key",
            privateKey: privateKey,
            signingDomain: "test.com"
          }
        ]
      } as any);
      fs.writeFileSync(session.emailPath, result.signatures + originalContent, "utf-8");
      filterResult = await mailauth.onData(session, "mailauth");
      assert.strictEqual(session.context.mailauth.dkim.results[0].status.result, "pass", "DKIM should pass");
      session.context = {};
      content = fs.readFileSync(session.emailPath, "utf-8");
      assert.ok(content.includes("dkim=pass"), "Should have contains dkim=pass");

      // Invalid DKIM signature
      // Wrong key
      result = await dkimSign(fs.createReadStream(session.emailPath), {
        signatureData: [
          {
            selector: "key",
            privateKey: privateKey2,
            signingDomain: "test.com"
          }
        ]
      } as any);
      fs.writeFileSync(session.emailPath, result.signatures + originalContent, "utf-8");
      filterResult = await mailauth.onData(session, "mailauth");
      content = fs.readFileSync(session.emailPath, "utf-8");
      assert.strictEqual(session.context.mailauth.dkim.results[0].status.result, "fail", "DKIM should fail");

      zone["key._domainkey.test.com"] = {
        TXT: [
          `v=DKIM1; k=rsa; p=${publicKey2
            .split("\n")
            .filter(p => !p.startsWith("----"))
            .join("")}`
        ]
      };
      filterResult = await mailauth.onData(session, "mailauth");
      content = fs.readFileSync(session.emailPath, "utf-8");
      assert.strictEqual(session.context.mailauth.dkim.results[0].status.result, "pass", "DKIM should pass");
      mailauth.config.mailauth.minBitLength = 2048;
      fs.writeFileSync(session.emailPath, result.signatures + originalContent, "utf-8");
      filterResult = await mailauth.onData(session, "mailauth");
      // Waiting on https://github.com/postalsys/mailauth/pull/84 to be merged
      //assert.strictEqual(session.context.mailauth.dkim.results[0].status.result, "fail", "DKIM should fail");
    } finally {
      // Restore original content
      await fs.promises.writeFile(session.emailPath, originalContent, "utf-8");
    }
  }
}
