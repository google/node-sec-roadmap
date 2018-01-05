# A Roadmap for Node.js Security

Node.js has a vibrant community of application developers and library
authors built around a mature and well-maintained core runtime and
library set.  However there are specific security concerns that a
primary target needs to address before using Node.js for public facing
applications and services.

This document discusses how some Node.js projects address these
concerns, along with ways to make it easier for other projects to
address these concerns in a thorough and consistent manner.

This is not the opinion of any organization.  It is the considered
opinion of
[some computer security professionals and node enthusiasts][contributors]
who have worked to make it easier to write secure, robust software on
other platforms; who like much about Node.js; and who would like to
help make it better.

Our intended audience is Node.js library and infrastructure
maintainers who want to stay ahead of the increased scrutiny that
Node.js is getting from attackers.  We have not researched whether,
and do not assert that, any stack is inherently more or less secure
than any other.

Node.js security is especially important for “primary targets”.
Targets are often subdivided into "primary targets" and "targets of
opportunity."  One attacks the latter if one happens to see a
vulnerability.  One goes out of their way to find vulnerabilities in
the former.  The practices which prevent one from becoming a target of
opportunity might not be enough if one is a primary target of an actor
with resources at their disposal.  We hope that the ideas we present
would help primary targets to defeat attacks while making targets of
opportunity become rare and the entire ecosystem more secure.

When addressing threats, we want to make sure we preserve Node.js's
strengths.

*  Development teams can iterate quickly allowing them to explore a
   large portion of the design space.
*  Developers can use a wealth of publicly available packages to solve
   everyday problems.
*  Anyone who identifies a shared problem can write and publish a
   module to solve it, or send a pull request with a fix or extension
   to an existing project.
*  Node.js integrates with a wide variety of application containers so
   project teams have options when deciding how to deploy.
*  Using JavaScript on the front and back ends of Web applications
   allows developers to work both sides when need be.

The individual chapters are largely independent of one another:

"[Threat environment][]" discusses the kinds of threats that concern us.

"[Dynamism when you need it][]" discusses how to preserve the power of
CommonJS module linking, `vm` contexts, and runtime code generation
while making sure that, in production, only code that the development
team trusts gets run.

"[Knowing your dependencies][]" discusses ways to help development
teams make informed decisions about third-party dependencies.

"[Keeping your dependencies close][]" discusses how keeping a local
replica of portions of the larger npm repository affects security and
aids incident response.

"[Oversight][]" discusses how code-quality tools can help decouple
security review from development.

"[When all else fails][]" discusses how the development &rarr;
production pipeline and development practices can affect the ability
of security professionals to identify and respond to imminent threats.

"[Library support for safe coding practices][]" discusses idioms
that, if more widespread, might make it easier for developers to
produce secure, robust systems.


[contributors]: CONTRIBUTORS.md
[Threat environment]: chapter-1/threats.md
[Dynamism when you need it]: chapter-2/dynamism.md
[Knowing your dependencies]: chapter-3/knowing_dependencies.md
[Keeping your dependencies close]: chapter-4/close_dependencies.md
[Oversight]: chapter-5/oversight.md
[When all else fails]: chapter-6/failing.md
[Library support for safe coding practices]: chapter-7/libraries.md
