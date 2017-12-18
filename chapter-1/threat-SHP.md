# Shell Injection during Production

[Shell injection][] occurs when an attacker-controlled string changes
the structure of a command passed to a shell or causes a child process
to execute an unintended command or with unintended arguments.
Typically, this is because code or a dependency invokes
[child_process][api/child_process] with an argument partially composed
from untrusted inputs.

Shell injection may also occur during development and deployment.
For example, [`npm`][npm hooks] and [`bower`][bower hooks]
`{pre-,post-,}install` hooks may be subject to shell injection
via filenames that contain shell meta-characters in malicious
transitive dependencies but we classify this as an [MTP][]
vulnerability.

[MTP]: threat-MTP.md
[npm hooks]: https://docs.npmjs.com/misc/scripts
[bower hooks]: https://bower.io/docs/config/#hooks
[Shell injection]: http://cwe.mitre.org/data/definitions/77.html
[api/child_process]: https://nodejs.org/api/child_process.html
