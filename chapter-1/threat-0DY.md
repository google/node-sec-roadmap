# Zero Day

When a researcher discloses a new security vulnerability, the clock
starts ticking.  An attacker can compromise a product if they can
weaponize the disclosure before the product team

*  realizes they're vulnerable, and
*  finds a patch to the vulnerable dependency, or rolls their own, and
*  tests the patched release and pushes it into production.

["The Best Defenses Against Zero-day Exploits for Various-sized
Organizations"][sans] notes

> Zero-day exploits are vulnerabilities that have yet to be publicly
> disclosed. These exploits are usually the most difficult to defend
> against because data is generally only available for analysis after
> the attack has completed its course.

> ...

> The research community has broadly classified the defense techniques
> against zero-day exploits as statistical-based, signature-based,
> behavior-based, and hybrid techniques (Kaur & Singh, 2014). The
> primary goal of each of these techniques is to identify the exploit in
> real time or as close to real time as possible and quarantine the
> specific attack to eliminate or minimize the damage caused by the
> attack.

Being able to respond quickly to limit damage and recover are
critical.

That same paper talks at length about *worms*: programs that
compromise a system without explicit direction by a human attacker,
and use the compromise of one system to find other systems to
automatically compromise.

Researchers have found ways ([details][saccone]) that worms
might propagate throughout `registry.npmjs.org` and common practices
that might allow a compromise to jump from the module repository to
large numbers of production servers.

If we can structure systems so that compromising one component
does not make it easier to compromise another component, then
we can contain damage due to worms.

If, in a population of components, we can keep susceptibility below a
critical threshold so that worms spend more time searching for targets
than compromising targets, then we can buy time for humans to
understand and respond.

If we prevent compromise of a population of modules by a zero day
from causing widespread compromise of a population of production
servers then we can limit damage to end users.

[sans]: https://www.sans.org/reading-room/whitepapers/bestprac/defenses-zero-day-exploits-various-sized-organizations-35562
[saccone]: https://www.kb.cert.org/CERT_WEB/services/vul-notes.nsf/6eacfaeab94596f5852569290066a50b/018dbb99def6980185257f820013f175/$FILE/npmwormdisclosure.pdf
