# Keeping your dependencies close

## Background

When deploying an application or service, many projects run `npm
install` which can cause problems.  [James Shore][] discusses the
problem and several solutions, none of which are ideal.

*  Network trouble reaching `registry.npmjs.org` becomes a single
   point of failure.
*  An extra `npm shrinkwrap` step is necessary to ensure that
   the versions used during testing are the same as the versions
   deployed (Shore's analysis predates [package locks][], or
*  Developers check `node_modules` into revision control which
   may include architecture-specific binaries.
*  Local changes may be silently lost when re-installed on a dev
   machine or on upgrade.

Many organizations use tools to manage a local replica.

*  [Artifactory][] is a language agnostic dependency manager that
   supports Node.
*  [Sinopia][] is a Node specific repository server.
*  [Verdaccio][] is fork of Sinopia.
*  [Yarn][] is a package manager backed by the same `registry.npmjs`
   but which can be pointed at an [offline mirror][].
   The offline mirror can have multiple tarballs per module to deal
   with architecture specific builds.  Its `--offline` mode prevents
   falling back to central, though does not prevent network fetches
   by module scripts.

Node's security working group has a [process][security-wg process] for
managing vulnerabilities in third-party code.

## Problem

Threats: [0DY][] [MTP][]

Security teams needs to match vulnerability reports with projects that
use affected modules so that they can respond to [zero days][0DY].
Centralizing module installation allows them to figure out whether a
report affects a module.

Large organizations with dedicated security specialists need to be
able to locally patch security issues or critical bugs and push to
production without waiting for upstream to push a new version.  When
someone in the organization discovers a vulnerability in a third-party
module, they should disclose it to the third-party maintainer, but
they should not wait before protecting end users who would be at risk
if an attacker independently discovered the same vulnerability.

## Success Criteria

We can have a reliable pipeline from the central repository,
through local repositories and to deployed services if:

*  A failure in `registry.npmjs.org` does not lead to compromise or
   denial of service by `npm install` during deployment, and/or
*  `npm install` is not necessary for deployment.

and

*  access to `registry.npmjs.org` is not necessary to publish
   a patch to an open source module as seen within an
   organization.

and

*  installing or deploying a module locally cannot abuse publish
   privileges, and/or
*  an organization can limit its exposure to compromise of
   `registry.npmjs.org`, and ideally vice-versa.

and

*  installation scripts only affect `node_modules` so cannot
   compromise local repositories, abuse commit privileges,
   or plant [trojans][trojan].


## Existing solutions

Having a local replica simplifies deploying targeted patches to
affected projects.  When responding, security specialists might
develop a patch before upstream.  They may be able to take into
account how their products use the module to produce a targeted patch
faster than upstream maintainers who have greater or
less-well-understood backwards compatibility constraints.

Keeping a local replica narrows the window for [MTP][] attacks.
Someone trying to inject malicious code has to have it up and
available from `registry.npmjs.org` at the time the install script
pulls it down which is hard for an attacker to predict.  There is a
monoculture tradeoff &mdash; having a smaller number of versions
across all projects increases the potential reach of such an attack
once successfully executed.  Centralized monitoring and reporting
tilts in the defenders' favor though.


## Incident Response

There is one piece that isn't provided directly by the local replica
providers aboce; security responders need a way to relate
vulnerability reports to affected projects when a [zero day][0DY]
clock starts ticking so they can figure out whom to notify.

*  If an organization shares revision control across all projects, then
   responders can find all `package.json`s and use git commit logs to
   identify likely points of contact.  Much of this is scriptable.
*  If an organization archives all production bundles before deployment,
   then tools can similarly scan archived bundles for `package.json`.
*  If an organization has an up-to-date database of projects with
   up-to-date links to revision control systems, then security teams
   may be able to automate scanning as above.
   Some managers like to have "skunkworks" projects that they keep
   out of project databases.
   Managers should be free to use codenames, but security teams need
   to ensure that "unlisted" doesn't mean "not supportable by
   incident response."
*  If none of the above work, security teams will need to maintain a
   database so that they have it when they need it.
   If the local replica is on a shared file system mount, then access
   logs may be sufficient.  If not, instrumenting `yarn`, may be the
   only option.

## Managing a Local Replica

If you don't have access to a commercial solution, some tooling can
make it easier to transition to and maintain a local replica.
We assume `yarn` below, but there are free versions of others which
may do some of this out of the box.

*  Developers' muscle memory may cause them to invoke `npm` instead of
   `yarn` so on a developer machine `$(which npm)` run in an
   [interactive shell][] should halt and remind the developer to use
   `yarn` instead.  Presubmit checks should scan scripts for
   invocations of `npm` to remind developers to use `yarn`.  It may be
   possible to use a project specific `.npmrc` with flags that cause
   it to dry-run or dump usage and exit, but this would affect
   non-interactive scripts so tread carefully.
*  A script can aid installing new modules into the local replica.
   It should:

   1. Run `yarn install --ignore-scripts` to fetch the module content
      into a revision controlled repository
   2. Build the module tarballs.  (See below)
   3. Check the revision controlled portion and any organization-specific
      metadata into revision control
   4. File a tracking issue for review of the new module, so that
      code quality checks can happen in parallel with the developers
      test-driving the module and figuring out whether it really
      solves their problem.
   5. Optionally, `yarn add`s the module to the developer's `package.json`.
*  Developers shouldn't have direct write access to the local replica
   so that malicious code running on a single developer's workstation
   cannot compromise other developers via the local replica.

Finally, all Node.js projects need to have a symlink to the
organization's `.yarnrc` at their root that points to the local
replica.

## Running install script safely

Running `{pre-,,post-}install` scripts without developer privileges
prevents malicious code (see [MTP][]) from:

*  Modifying code in a local repository.
*  Committing code as the developer possibly signing commits
   with keys available to `ssh-agent`.
*  Adding scripts to directories on a developer's `$PATH`.
*  Abusing `npm login` or [`yarn login`][] credentials.

Ideally one would run these on a separate sandboxed machine.
Many organizations have access to banks of machines that
test client-side JavaScript apps by running instrumented
browsers and include Windows boxes for testing IE, and
MacOS boxes for testing Safari.  These banks might also
run install scripts without any developer privileges and
with an airgap between the install scripts and source code
files.

If that doesn't work, running install scripts via `sudo -u `*guest*
where *guest* is a low-privilege account makes it harder for the
install script to piggyback on the developer's private keys.

## Proposed Solutions

A local replica manager should make it easy to:

*  Locally cache npm packages so that an interruption in service by
   `registry.npmjs` doesn't affect the ability to deploy a security
   update to existing products.
*  Cherrypick versions from `registry.npmjs` so that reviewers can
   exercise oversight, and remove versions with known,
   security-relevant regressions.
*  Publish one's own local patches to packages in the global
   namespace, so that incident responders can workaround zero-days
   without waiting for upstream.
*  Associate organization specific metadata with packages and versions
   so that the organization can aggregate lessons learned about
   specific dependencies.
*  Cross-compile binaries so that developers do not have to run
   installation scripts on their own machines.

The local repository providers mentioned above address many of these,
but we have not comprehensively evalated any of them.

Cherrypicking a version should not require using a tool other than
`npm` or `yarn`.  Cherrypicking a version when `npm` communicates
directly with `registry.npmjs` should be a no-op, so the `npm`
interface could support cherrypicking.

Existing tools do not prevent abuse of developer privileges by install
scripts.  The first tool to do so should be preferred by security
conscious organizations.

Ideally `npm` and `yarn` would be configurable so that they could
delegate running installation script to a local replica manager.  We
would like to see local replica managers compete on their ability to
do so securely.  We realize that this is no small change, but abuse of
developer privileges can directly affect source base integrity.

If an `npm` configuration could opt into sending the project name from
`package.json` then local replica managers could make it easier for
incident responders to find projects affected by a security alert for
a specific module.


[James Shore]: https://www.letscodejavascript.com/v3/blog/2014/03/the_npm_debacle
[package locks]: https://docs.npmjs.com/files/package-lock.json
[Artifactory]: https://www.jfrog.com/confluence/display/RTF/Npm+Registry#NpmRegistry-AdvancedConfiguration
[Sinopia]: https://www.npmjs.com/package/sinopia#override-public-packages
[Verdaccio]: https://github.com/verdaccio/verdaccio/blob/66b2175584e29587be0fd7979ea9f9c73b08b8e9/docs/use-cases.md#override-public-packages
[yarn]: https://github.com/yarnpkg/yarn
[security-wg process]: https://github.com/nodejs/security-wg/blob/master/processes/third_party_vuln_process.md
[0DY]: ../chapter-1/threat-0DY.md
[MTP]: ../chapter-1/threat-MTP.md
[offline mirror]: https://yarnpkg.com/blog/2016/11/24/offline-mirror/
[interactive shell]: http://www.tldp.org/LDP/abs/html/intandnonint.html#IITEST
[CVE-IDs]: https://en.wikipedia.org/wiki/Common_Vulnerabilities_and_Exposures#CVE_identifiers
[saccone]: https://www.kb.cert.org/CERT_WEB/services/vul-notes.nsf/6eacfaeab94596f5852569290066a50b/018dbb99def6980185257f820013f175/$FILE/npmwormdisclosure.pdf
[`yarn login`]: https://yarnpkg.com/en/docs/cli/login
[trojan]: https://en.wikipedia.org/wiki/Trojan_horse_(computing)
