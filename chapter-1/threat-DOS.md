
# Denial of Service

Denial of service occurs when a well-behaved, authorized user cannot
access a system because of misbehavior by another.

"Denial of service" is most often associated with [flooding][] a
network endpoint so it cannot respond to the smaller number of
legitimate requests, but there are other vectors:

*  Causing the server to use up [a finite resource][res-exh]
   like file descriptors causing threads to block.
*  Causing the target to issue a network request to an endpoint the
   attacker controls and responding slowly.
*  Causing the target to store malformed data which triggers an error
   in code that unpacks the stored data and causes a server to provide
   an error response to a well-formed request.
*  Exploiting event dispatch bugs to cause starvation
   ([example][disclosure]).
*  Supplying over-large inputs to super-linear (> O(n)) algorithms.
   For example supplying a crafted string to an ambiguous `RegExp`
   to cause [excessive backtracking][].

Denial of service attacks that exploit the network layer are usually
handled in the reverse proxy and we find no reason to suppose that
node applications are especially vulnerable to other kinds of denial
of service.

## Additional risk: Integrity depends on quick completion

A system requires [atomicity][] when two or more effects have to
happen together or not at all.  Databases put a lot of engineering
effort into ensuring atomicity.

Sometimes, ad-hoc code seems to preserve atomicity when tested under
low-load conditions:

```js
// foo() and bar() need to happen together or not at all.
foo(x);
// Not much of a gap here under normal conditions for another part
// of the system to observe foo() but not bar().
try {
  bar(x);
} catch (e) {
  undoFoo();
  throw e;
}
```

This code, though buggy, may be highly reliable under normal
conditions, but may fail under load, or if an attacker can cause
`bar()` to run for a while before its side-effect happens, for example
by causing excessive backtracking in a regular expression used to
check a precondition.

Some of the same techniques which makes a system unavailable can
widen the window of vulnerability within which an attacker can exploit
an atomicity failure.

Client-side, runaway computations rarely escalate into an integrity
violation since atomicity requirements are typically maintained on the
server.  Server-side, we expect that this problem would be more
common.

[flooding]: https://capec.mitre.org/data/definitions/125.html
[excessive backtracking]: https://www.regular-expressions.info/catastrophic.html
[res-exh]: https://capec.mitre.org/data/definitions/131.html
[disclosure]: https://sandstorm.io/news/2015-04-08-osx-security-bug
[atomicity]: https://en.wikipedia.org/wiki/ACID#Atomicity
