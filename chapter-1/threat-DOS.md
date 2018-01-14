# Denial of Service

Denial of service occurs when a well-behaved, authorized user cannot
access a system because of misbehavior by another.

"Denial of service" is most often associated with [flooding][] a
network endpoint so it cannot respond to the smaller number of
legitimate requests, but there are other vectors:

*  Supplying crafted strings to ambiguous `RegExp`s causing
   [excessive backtracking][].
*  Causing the server to use up [a finite resource][res-exh]
   like file descriptors causing threads to block.
*  Causing the target to issue a network request to an endpoint the
   attacker controls and responding slowly.
*  Causing the target to store malformed data which triggers an error
   in code that unpacks the stored data and causes a server to provide
   an error response to a well-formed request.
*  Supplying over-large inputs to super-linear (> O(n)) algorithms.

Denial of service attacks that exploit the network layer are usually
handled in the reverse proxy and we find no reason to suppose that
node applications are especially vulnerable to other kinds of denial
of service.

## Additional risk: Integrity depends on Availability or Completion

A transactional requirement is when two or more effects have to happen
together or not at all.

If there is a transactional requirement maintained by ad-hoc methods,
and an attacker can cause computation to halt after part of the
transaction, they have a wide window within which to exploit the fact
that the later effects have not happened.

Client-side, runaway computations rarely translate into an integrity
violation since transactional requirements are typically maintained on
the server.  Server-side, we would expect to find more code that uses
ad-hoc methods to maintain transactional requirements so unfinished
computations are more likely to violate system integrity.

[flooding]: https://capec.mitre.org/data/definitions/125.html
[excessive backtracking]: https://www.regular-expressions.info/catastrophic.html
[res-exh]: https://capec.mitre.org/data/definitions/131.html

