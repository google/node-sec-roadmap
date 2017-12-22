# Oversight


## Problem

Threats: [BOF][] [CRY][] [DEX][] [EXF][] [LQC][] [QUI][] [RCE][] [SHP][]

Manually reviewing third party modules for known security problems
is time consuming.

Having developers wait for such review unnecessarily slows down
development.

Our engineering processes ought not force us to choose between
forgoing sanity checks and shipping code in a timely manner.


## Background

[JSConformance][] allows a project team to specify a policy for
Closure JavaScript.  This policy can encode lessons learned about APIs
that are prone to misuse.  By taking into account type information
about arguments and `this`-values it can distinguish problematic
patterns like `setTimeout(aString, dt)` from unproblematic ones
`setTimeout(aFunction, dt)`.

[TSLint][tslint] and [ESLint][eslint] both allow custom rules so can
be extended as a project or developer community identifies Good and
Bad parts of JavaScript for their particular context.



## A possible solution

### Encode lessons learned by the community in linter policies

Instead of having security specialists reviewing lots of code
they should focus on improving tools.
Some APIs and idioms are more prone to misuse than others, and some
should be deprecated in favor of more robust ways of expressing the
same idea.  As the community reaches a rough consensus that a code
pattern is prone to misuse or there is a more robust alternative, we
could try to encode that knowledge in an automatable policy.

Linters are not perfect.  There are no sound production-quality static
type systems for JavaScript, so its linters are also necessarily
heuristic.  TSLint typically has more fine-grained type information
available than ESLint, so there are probably more anti-patterns that
TSLint can identify with an acceptable false-positive rate than
ESLint, but feedback about what can and can't be expressed in ESLint
might give its maintainers useful feedback.

Linters can reduce the burden on reviewers by enabling computer aided
code review &mdash; helping reviewers focus on areas that use powerful
APIs, and giving a sense of the kinds of problems to look out for.

They can also give developers a sense of how controversial a review
might be, and guide them in asking the right kinds of questions.

Custom policies can also help educate developers about alternatives.

The rule below specifies an anti-pattern for client-side JavaScript
in machine-checkable form, assigns it a name, has a short summary that
can appear in an error message, and a longer description or
documentation URL that explains the reasoning behind the rule.

It also documents a number of known exceptions to the rule, for
example, APIs that wrap `document.write` to do additional checks.

```pb
requirement: {
  rule_id: 'closure:documentWrite'
  type: BANNED_PROPERTY
  error_message: 'Using Document.prototype.write is not allowed. '
      'Use goog.dom.safe.documentWrite instead.'
      ''
      'Any content passed to write() will be automatically '
      'evaluated in the DOM and therefore the assignment of '
      'user-controlled, insufficiently sanitized or escaped '
      'content can result in XSS vulnerabilities.'
      ''
      'Document.prototype.write is bad for performance as it '
      'forces document reparsing, has unpredictable semantics '
      'and disallows many optimizations a browser may make. '
      'It is almost never needed.'
      ''
      'Exceptions allowed for:'
      '* writing to a completely new window such as a popup '
      '  or an iframe.'
      '* frame busting.'
      ''
      'If you need to use it, use the type-safe '
      'goog.dom.safe.documentWrite wrapper, or directly '
      'render a Strict Soy template using '
      'goog.soy.Renderer.prototype.renderElement (or similar).'

  value: 'Document.prototype.write'
  value: 'Document.prototype.writeln'

  # These uses have been determined to be safe by manual review.
  whitelist: 'javascript/closure/async/nexttick.js'
  whitelist: 'javascript/closure/base.js'
  whitelist: 'javascript/closure/dom/safe.js'
}
```

----

We propose a project that maintains a set of linter policies per language:

*  A **common** policy suitable for all projects that identifies
   anti-patterns that are generally regarded as bad practice by the
   community with a low false positive rate.
*  A **strict** policy suitable for projects that are willing to
   deal with some false positives in exchange for identifying more
   potential problems.
*  An **experimental** policy that projects that want to contribute to
   linter policy development can use.
   New rules go here first, so that rule maintainers can get feedback
   about their impact on real code.


### Decouple Reviews from Development

Within a large organization, there are often multiple review cycles, some
concurrent:

-  Reviews of designs and use cases where developers gather information
   from others.
-  Code reviewers critique pull requests for correctness, maintainability,
   testability.
-  Release candidate reviews where professional testers examine a
   partial system and try to break it.
-  Pre-launch reviews where legal, security & privacy, and other
   concerned parties come to understand the state of the system and
   weigh in on what they need to be able to support its deployment.
-  Limited releases where trusted users get to use an application.

Reviews should happen early and late.  When designing a system or a
new feature, technical leads should engage specialists.  Before
shipping, they should circle back to double check the implementation.
During rapid development though, developers should drive development
&mdash; they may ask questions, and may receive feedback (solicited
and not), but ought not have to halt work while they wait for reviews
from specialists.

Some changes have a higher security impact than other, so
some will require review by security specialists, but not most.

During an ongoing security review, security specialists can contribute
use cases and test cases; file issues; and help to integrate tools
like linters, fuzzers, and vulnerability scanners.

As described in "[Keeping your dependencies close][]", new third-party
modules are of particular interest to security specialists, but
shouldn't require security review before developers use them on an
experimental basis.

There are a many workflows that allows people to work independently
and later circle back so that nothing falls through the cracks.
Below is one that has worked in similar contexts:

1. The developer (or the automated import script) files a
   tracking issue that is a prerequisite for pre-launch review.
2. If the developer later finds out that they don't plan on using
   the unreviewed module, they can close the tracking issue.
3. The assigned security specialist asks follow-up questions and
   reports their findings via the tracking issue.
4. A common pre-launch script checks queries a module metadata
   databased maintained by security to identify still-unvetted
   dependencies.

[BOF]: ../chapter-1/threat-BOF.md
[CRY]: ../chapter-1/threat-CRY.md
[DEX]: ../chapter-1/threat-DEX.md
[EXF]: ../chapter-1/threat-EXF.md
[LQC]: ../chapter-1/threat-LQC.md
[RCE]: ../chapter-1/threat-RCE.md
[SHP]: ../chapter-1/threat-SHP.md
[QUI]: ../chapter-1/threat-QUI.md
[JSConformance]: https://github.com/google/closure-compiler/wiki/JS-Conformance-Framework
[tslint]: https://palantir.github.io/tslint/develop/custom-rules/
[eslint]: https://eslint.org/docs/developer-guide/working-with-rules-new#runtime-rules
[Keeping your dependencies close]: ../chapter-4/close_dependencies.md
