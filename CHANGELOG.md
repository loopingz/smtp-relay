# v1.2.0 (Wed Jan 25 2023)

#### 🚀 Enhancement

- ci: update json schema prior to release [#55](https://github.com/loopingz/smtp-relay/pull/55) ([@loopingz](https://github.com/loopingz))
- feat: add verbose log (Close #36) [#55](https://github.com/loopingz/smtp-relay/pull/55) ([@loopingz](https://github.com/loopingz))
- feat: add json schema for config file [#55](https://github.com/loopingz/smtp-relay/pull/55) ([@loopingz](https://github.com/loopingz))
- feat: add prometheus support (Close #52) [#55](https://github.com/loopingz/smtp-relay/pull/55) ([@loopingz](https://github.com/loopingz))

#### 🐛 Bug Fix

- fix: prometheus coverage [#55](https://github.com/loopingz/smtp-relay/pull/55) ([@loopingz](https://github.com/loopingz))

#### Authors: 1

- Remi Cattiau ([@loopingz](https://github.com/loopingz))

---

# v1.1.0 (Wed Jan 25 2023)

#### 🚀 Enhancement

- feat: add @webda/workout logger system (Close #53) [#54](https://github.com/loopingz/smtp-relay/pull/54) ([@loopingz](https://github.com/loopingz))

#### 🐛 Bug Fix

- chore: update dependabot settings and add small doc [#54](https://github.com/loopingz/smtp-relay/pull/54) ([@loopingz](https://github.com/loopingz))

#### 🔩 Dependency Updates

- build(deps): bump @aws-sdk/client-ses from 3.234.0 to 3.235.0 [#48](https://github.com/loopingz/smtp-relay/pull/48) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps): bump @aws-sdk/client-s3 from 3.234.0 to 3.235.0 [#49](https://github.com/loopingz/smtp-relay/pull/49) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps): bump @aws-sdk/client-sqs from 3.234.0 to 3.235.0 [#51](https://github.com/loopingz/smtp-relay/pull/51) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps): bump @aws-sdk/client-sqs from 3.231.0 to 3.234.0 [#44](https://github.com/loopingz/smtp-relay/pull/44) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps): bump @aws-sdk/client-s3 from 3.231.0 to 3.234.0 [#45](https://github.com/loopingz/smtp-relay/pull/45) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps-dev): bump esbuild from 0.16.9 to 0.16.10 [#46](https://github.com/loopingz/smtp-relay/pull/46) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps): bump @aws-sdk/client-ses from 3.231.0 to 3.234.0 [#47](https://github.com/loopingz/smtp-relay/pull/47) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps-dev): bump esbuild from 0.16.7 to 0.16.9 [#42](https://github.com/loopingz/smtp-relay/pull/42) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps-dev): bump prettier-plugin-organize-imports [#41](https://github.com/loopingz/smtp-relay/pull/41) ([@dependabot[bot]](https://github.com/dependabot[bot]))

#### Authors: 2

- [@dependabot[bot]](https://github.com/dependabot[bot])
- Remi Cattiau ([@loopingz](https://github.com/loopingz))

---

# v1.0.2 (Fri Dec 16 2022)

#### 🐛 Bug Fix

- ci: publish version w/o release label [#40](https://github.com/loopingz/smtp-relay/pull/40) ([@loopingz](https://github.com/loopingz))
- fix: use deploykey instead of gh actions creds for push [#39](https://github.com/loopingz/smtp-relay/pull/39) ([@loopingz](https://github.com/loopingz))

#### Authors: 1

- Remi Cattiau ([@loopingz](https://github.com/loopingz))

---

# v1.0.1 (Thu Dec 15 2022)

#### 🐛 Bug Fix

- fix: docker builder [#38](https://github.com/loopingz/smtp-relay/pull/38) ([@loopingz](https://github.com/loopingz))

#### Authors: 1

- Remi Cattiau ([@loopingz](https://github.com/loopingz))

---

# v1.0.0 (Thu Dec 15 2022)

:tada: This release contains work from a new contributor! :tada:

Thank you, Remi Cattiau ([@loopingz](https://github.com/loopingz)), for all your work!

#### 💥 Breaking Change

- build(deps-dev): bump @types/mocha from 9.1.1 to 10.0.1 [#27](https://github.com/loopingz/smtp-relay/pull/27) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps-dev): bump sinon from 14.0.2 to 15.0.0 [#28](https://github.com/loopingz/smtp-relay/pull/28) ([@dependabot[bot]](https://github.com/dependabot[bot]))

#### 🚀 Enhancement

- fix: add missing plugin [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- feat: add auto shipit configuration [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: add .env to gitignore [#31](https://github.com/loopingz/smtp-relay/pull/31) ([@loopingz](https://github.com/loopingz))
- feat: add yaml support for configuration file (Close #23) ([@loopingz](https://github.com/loopingz))
- feat: move to ESM module ([@loopingz](https://github.com/loopingz))
- feat: add a static-auth filter ([@loopingz](https://github.com/loopingz))
- build(deps-dev): bump @testdeck/mocha from 0.2.2 to 0.3.3 [#30](https://github.com/loopingz/smtp-relay/pull/30) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- feat: add AWS and Nodemailer implementation ([@loopingz](https://github.com/loopingz))
- feat: add cloudevent and gcp storage and pubsub ([@loopingz](https://github.com/loopingz))
- feat: add jsonc capabilities ([@loopingz](https://github.com/loopingz))
- feat: add basic whitelist filter ([@loopingz](https://github.com/loopingz))
- feat: first commit ([@loopingz](https://github.com/loopingz))

#### 🐛 Bug Fix

- ci: remove docker plugin for auto [#37](https://github.com/loopingz/smtp-relay/pull/37) ([@loopingz](https://github.com/loopingz))
- ci: build container on tag push [#37](https://github.com/loopingz/smtp-relay/pull/37) ([@loopingz](https://github.com/loopingz))
- fix: try to trigger 0.1.1 release [#37](https://github.com/loopingz/smtp-relay/pull/37) ([@loopingz](https://github.com/loopingz))
- ci: update workflows trigger [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: increase timeout for yarn install [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- fix: Docker SIGINT handler [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: test [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: remove canary deployment [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: use yarn.lock in ci [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: add yarn.lock [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: add workflow [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- fix: allow usage of EKS service accounts [#22](https://github.com/loopingz/smtp-relay/pull/22) ([@loopingz](https://github.com/loopingz))
- ci: split sonarcloud ci [#22](https://github.com/loopingz/smtp-relay/pull/22) ([@loopingz](https://github.com/loopingz))
- ci: disable stip-json-comments update as it enforce ESM [#5](https://github.com/loopingz/smtp-relay/pull/5) ([@loopingz](https://github.com/loopingz))
- Update README.md [#5](https://github.com/loopingz/smtp-relay/pull/5) ([@loopingz](https://github.com/loopingz))

#### ⚠️ Pushed to `main`

- docs: exclude dependabot ([@loopingz](https://github.com/loopingz))
- ci: add all-contributors ([@loopingz](https://github.com/loopingz))
- ci: add auto release manager ([@loopingz](https://github.com/loopingz))
- docs: improve README readability ([@loopingz](https://github.com/loopingz))
- ci: add auth test ([@loopingz](https://github.com/loopingz))
- ci: move to node16 and greater ([@loopingz](https://github.com/loopingz))
- refactor: use organize-imports ([@loopingz](https://github.com/loopingz))
- ci: remove cov on sonarcloud ([@loopingz](https://github.com/loopingz))
- refactor: sonar code smells ([@loopingz](https://github.com/loopingz))
- ci: add gcp test ([@loopingz](https://github.com/loopingz))
- docs: update sonarcloud badge ([@loopingz](https://github.com/loopingz))
- ci: add badges ([@loopingz](https://github.com/loopingz))
- ci: add more unit tests ([@loopingz](https://github.com/loopingz))
- refactor: move to SmtpComponent root class ([@loopingz](https://github.com/loopingz))
- ci: sonar update to project ([@loopingz](https://github.com/loopingz))
- ci: add missing sonar file ([@loopingz](https://github.com/loopingz))
- ci: add github files ([@loopingz](https://github.com/loopingz))
- ci: add basic workflows ([@loopingz](https://github.com/loopingz))
- v0.0.1 ([@loopingz](https://github.com/loopingz))

#### Authors: 2

- [@dependabot[bot]](https://github.com/dependabot[bot])
- Remi Cattiau ([@loopingz](https://github.com/loopingz))

---

# (Thu Dec 15 2022)

#### 💥 Breaking Change

- build(deps-dev): bump @types/mocha from 9.1.1 to 10.0.1 [#27](https://github.com/loopingz/smtp-relay/pull/27) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- build(deps-dev): bump sinon from 14.0.2 to 15.0.0 [#28](https://github.com/loopingz/smtp-relay/pull/28) ([@dependabot[bot]](https://github.com/dependabot[bot]))

#### 🚀 Enhancement

- fix: add missing plugin [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- feat: add auto shipit configuration [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: add .env to gitignore [#31](https://github.com/loopingz/smtp-relay/pull/31) ([@loopingz](https://github.com/loopingz))
- feat: add yaml support for configuration file (Close #23) ([@loopingz](https://github.com/loopingz))
- feat: move to ESM module ([@loopingz](https://github.com/loopingz))
- feat: add a static-auth filter ([@loopingz](https://github.com/loopingz))
- build(deps-dev): bump @testdeck/mocha from 0.2.2 to 0.3.3 [#30](https://github.com/loopingz/smtp-relay/pull/30) ([@dependabot[bot]](https://github.com/dependabot[bot]))
- feat: add AWS and Nodemailer implementation ([@loopingz](https://github.com/loopingz))
- feat: add cloudevent and gcp storage and pubsub ([@loopingz](https://github.com/loopingz))
- feat: add jsonc capabilities ([@loopingz](https://github.com/loopingz))
- feat: add basic whitelist filter ([@loopingz](https://github.com/loopingz))
- feat: first commit ([@loopingz](https://github.com/loopingz))

#### 🐛 Bug Fix

- ci: update workflows trigger [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: increase timeout for yarn install [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- fix: Docker SIGINT handler [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: test [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: remove canary deployment [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: use yarn.lock in ci [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: add yarn.lock [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- ci: add workflow [#34](https://github.com/loopingz/smtp-relay/pull/34) ([@loopingz](https://github.com/loopingz))
- fix: allow usage of EKS service accounts [#22](https://github.com/loopingz/smtp-relay/pull/22) ([@loopingz](https://github.com/loopingz))
- ci: split sonarcloud ci [#22](https://github.com/loopingz/smtp-relay/pull/22) ([@loopingz](https://github.com/loopingz))
- ci: disable stip-json-comments update as it enforce ESM [#5](https://github.com/loopingz/smtp-relay/pull/5) ([@loopingz](https://github.com/loopingz))
- Update README.md [#5](https://github.com/loopingz/smtp-relay/pull/5) ([@loopingz](https://github.com/loopingz))

#### ⚠️ Pushed to `main`

- docs: exclude dependabot ([@loopingz](https://github.com/loopingz))
- ci: add all-contributors ([@loopingz](https://github.com/loopingz))
- ci: add auto release manager ([@loopingz](https://github.com/loopingz))
- docs: improve README readability ([@loopingz](https://github.com/loopingz))
- ci: add auth test ([@loopingz](https://github.com/loopingz))
- ci: move to node16 and greater ([@loopingz](https://github.com/loopingz))
- refactor: use organize-imports ([@loopingz](https://github.com/loopingz))
- ci: remove cov on sonarcloud ([@loopingz](https://github.com/loopingz))
- refactor: sonar code smells ([@loopingz](https://github.com/loopingz))
- ci: add gcp test ([@loopingz](https://github.com/loopingz))
- docs: update sonarcloud badge ([@loopingz](https://github.com/loopingz))
- ci: add badges ([@loopingz](https://github.com/loopingz))
- ci: add more unit tests ([@loopingz](https://github.com/loopingz))
- refactor: move to SmtpComponent root class ([@loopingz](https://github.com/loopingz))
- ci: sonar update to project ([@loopingz](https://github.com/loopingz))
- ci: add missing sonar file ([@loopingz](https://github.com/loopingz))
- ci: add github files ([@loopingz](https://github.com/loopingz))
- ci: add basic workflows ([@loopingz](https://github.com/loopingz))
- v0.0.1 ([@loopingz](https://github.com/loopingz))

#### Authors: 2

- [@dependabot[bot]](https://github.com/dependabot[bot])
- Remi Cattiau ([@loopingz](https://github.com/loopingz))
