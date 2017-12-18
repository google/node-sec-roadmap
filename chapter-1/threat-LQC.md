# Low Quality Code

An application or service is vulnerable when its security depends on a
module upholding a contract that it does not uphold.

Most new software has bugs when first released.  Over time, maintainers
fix the bugs that have obvious, bad consequences.

Often, widely used software has problem areas that are well understood.
Developers can make a pragmatic decision to use it while taking
additional measures to make sure those problems don't compromise
security guarantees.

Orphaned code that has not been updated recently may have done a
good job of enforcing its contract, but attackers may have discovered
new tricks, or the threat environment may have changed so it may
no longer enforce its contract in the face of an attack.

Low quality code constitutes a threat when developers pick a module
without understanding the caveats to the contract it actually
provides, or without taking additional measures to limit damage when
it fails.

It may be the case that there's higher risk of poorly understood
contracts when a community is experimenting rapidly as is the case for
Node.js, or early on before the community has settled on clear winners
for core functions, but we consider the frequency of vulnerabilities
due to low quality code in the npm repository roughly the same as for
other public module repositories.
