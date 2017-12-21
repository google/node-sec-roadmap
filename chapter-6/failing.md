# When all else fails

## Background

The ["Incident Handlers Handbook"][SANS] discusses at length how to
respond to security breaches, but the main takeaways are:

*  You need to do work before incidents happen to be able to
   respond effectively.
*  Similar measures can lower the rate of incidents.
*  You will still have incidents.
*  Being in a position to respond effectively can limit damage when
   incidents occur.

Node's proposed [security working group][security-wg]
includes in its charter measures to route information about
vulnerabilities and fixes to the right places, and coordinate response
and disclosure.

Package monitoring services like [snyk][], GitHub's
[package graph][github graph], and the [nodejs-sec list][nodejs-sec]
aim to help vulnerability reports get to those who need them.


## Problem

Threats: [0DY][]

Node's security working group is working on a lot of preparedness
issues so we only address a few.

### Naming is hard

Each of the groups mentioned above is doing great work trying to help
patches get to those who need them.  Each seems to be rolling their own
naming scheme for vulnerabilities.

The computer security community has a
[centralized naming scheme][CVE-IDs] for vulnerability reports so that
reports don't fall through the cracks.  Security responders rarely
have the luxury of dealing with a single stack much less a single
layer of that stack so mailing lists are not sufficient --- if
reporters roll their own naming scheme or only disclose via
unstructured text, reports will fall through the cracks.

### Logging

When trying to diagnose a problem, responders often look to log files.
There has been much written on how to protect logs from
[forgery][log injection].

```js
console.log(s);
```

on a stack node runtime allows an attacker who controls `s` to write
any content to a log.

```js
console.log('MyModule: ' + s);
```

is a bit better.  An attacker has to insert a newline character into
`s` to forge another modules log prefix, and can't get rid of the
previous one.


## Success Criteria

Incident responders would have the tools necessary to do their jobs if

*  Security specialists can subscribe to a stream of notifications
   that include the vast majority of actionable security disclosures.
*  Responders can narrow down which code generated which log entries.


## Possible solutions

### Naming

Use CVE-IDs if at all possible when disclosing a vulnerability.  There
is a CNA for Node.js but that doesn't cover non-core npm modules and
other CNAs cover runtime dependencies like OpenSSL.  If there is no
other CNA that is appropriate, MITRE will issue an ID.

### Logging

On module load, the builtin `module.js` creates a new version of
`require` for each module so that it can make sure that the module path
gets passed as the module parent parameter.

The same mechanism could create a distinct `console` logger for each
module that narrows down the source of a message, and makes it
unambiguous where one message ends and the next starts.  For example:

1. Replace all `/\r\n?/g` in the log message text with `'\n'`
   and emit a CRLF after the log message to prevent forgery by
   line splitting.
2. Prefix it with the module filename and a colon.

With this, an incident responder reading a log message can reliably
tell that the module mentioned is where the log message originated, as
long as the attacker didn't get write access to the log file.
Preventing log deletion by other processes is better handled by
Linux's `FS_APPEND_FL` and similar mechanisms than in node.


[snyk]: https://snyk.io/vuln?packageManager=npm
[github graph]: https://github.com/blog/2447-a-more-connected-universe
[nodejs-sec]: https://groups.google.com/group/nodejs-sec
[CVE-IDs]: https://en.wikipedia.org/wiki/Common_Vulnerabilities_and_Exposures#CVE_identifiers
[log injection]: https://www.owasp.org/index.php/Log_Injection
[0DY]: ../chapter-1/threats.md
[SANS]: https://www.sans.org/reading-room/whitepapers/incident/incident-handlers-handbook-33901
[security-wg]: https://github.com/nodejs/security-wg
