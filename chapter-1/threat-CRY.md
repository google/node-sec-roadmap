# Weak Crypto {#CRY}

Cryptographic primitives are often the only practical way to solve
important classes of problems, but it's easy to make mistakes when using
`crypto.*` APIs.
Failing to identify third-party modules that use crypto (or should be
using crypto) and determining whether they are using it properly can lead
to a false sense of security.

["Developer-Resistant Cryptography"][Cairns & Steel] by Cairns & Steel
notes:

> The field of cryptography is inherently difficult. Cryptographic API
> development involves narrowing a large, complex field into a small set
> of usable functions.  Unfortunately, these APIs are often far from
> simple.

> ...

> In 2013, study by Egele et al. revealed even more startling figures
> [1]. In this study, six rules were defined which, if broken, indicated
> the use of insecure protocols. More than 88% of the 11,000 apps
> analyzed broke at least one rule. Of the rule-breaking apps, most
> would break not just one, but multiple rules. Some of these errors
> were attributed to negligence, for example test code included in
> release versions. However, in most cases it appears developers
> unknowingly created insecure apps.

> ...

> The human aspect can be improved through better education for
> developers.  Sadly, this approach is unlikely to be a complete
> solution. It is unreasonable to expect a developer to be a security
> expert when most of their time is spent on other aspects of software
> design.

Code that uses cryptography badly can seem like it's working as intended
until an attacker unravels it.
Testing code that uses cryptographic APIs is hard.  It's hard to write
a unit test to check that a skilled cryptographer can't efficiently
extract information from a random looking string or compute a random
looking string that passes a verifier.

Weak cryptography can also mask other problems.  For example, a
security auditor might try to check for leaks of email addresses by
creating a dummy account `Carol <carol@example.com>` and
check for the string `carol@example.com` in data served in responses,
while recursing into substrings encoded using base64, gzip, or other
common encodings.
If some of that data is poorly encrypted, then the auditor might
falsely conclude that an attacker who can't break strong
encryption does not have access to emails.

[Cairns & Steel]: https://www.w3.org/2014/strint/papers/48.pdf
