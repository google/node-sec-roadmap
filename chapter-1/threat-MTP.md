# Malicious Third-Party Code

Most open-source developers work in good faith to provide useful tools
to the larger community of developers but

*  Passwords are easy to guess, so attackers can suborn accounts that
   are only protected by a password.
   On GitHub, developers may configure their accounts to require a
   [second factor][github-second-factor] but this is not yet the norm.
*  Pull requests that aren't thoroughly reviewed may dilute security
   properties.
*  Phishing requests [targeted at GitHub users][dimnie] can execute
   code on unwary committers' machines.
*  A pull request may [appear to come][unsigned commits] from a
   higher-reputation source.

Malicious code ([POC][saccone]) can affect the server-side JavaScript
running in production, or can take the form of install hooks that run
on a developer workstation with access to local repositories and to
writable elements of `$PATH`.

Projects that deploy the latest version of a dependency straight to
production are more vulnerable to malicious code.  If an attacker
manages to publish a version with malicious code which is quickly
discovered, it affects projects that deploy during that short "window
of vulnerability."  Projects that `npm install` the latest version
straight to production are more likely to fall in that window than
projects that cherrypick versions or that shrinkwrap to make sure that
their development versions match deployed versions.

[Bower is deprecated][] so our discussions focus on `npmjs.org`, but
it's worth noting that Bower has a single-point of failure.  Anyone
who can create a release branch can commit and publish a new version.

[`npm profile`][] allows [enabling two factor auth][npm auth-and-writes]
for publishing and privilege changes.  If the npm accounts that
can publish new versions of a package only checkout code from a GitHub
account all of whose committers use two factors, then there is no
single password that can compromise the system.

The frequency of malicious code vulnerabilities affecting Node.js is
probably roughly the same as that for other public module
repositories.

[github-second-factor]: https://help.github.com/articles/about-two-factor-authentication/
[Bower is deprecated]: https://bower.io/blog/2017/how-to-migrate-away-from-bower/
[dimnie]: https://researchcenter.paloaltonetworks.com/2017/03/unit42-dimnie-hiding-plain-sight/
[unsigned commits]: https://nvisium.com/blog/2017/06/21/securing-github-commits-with-gpg-signing/
[`npm profile`]: https://docs.npmjs.com/cli/profile
[saccone]: https://www.kb.cert.org/CERT_WEB/services/vul-notes.nsf/6eacfaeab94596f5852569290066a50b/018dbb99def6980185257f820013f175/$FILE/npmwormdisclosure.pdf
[npm auth-and-writes]: https://docs.npmjs.com/getting-started/using-two-factor-authentication
