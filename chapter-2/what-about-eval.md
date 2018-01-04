# What about `eval`?

Previously we've talked about how to control what code loads
from the file system, but not what code loads from strings.

The rest of this discussion uses the term "`eval`" to refer to any of
the `eval` operator, the `eval` function, `new Function`,
`setTimeout(string, dt)`, `vm.runIn*Context`, `vm.Script.run*`,
[`WebAssembly.compile`][] and other operators
that convert strings or bytes into code.

Recall that it is difficult to prove that code
[does not `eval`](../chapter-1/threat-RCE.md):

```js
var x = {},
    a = 'constructor',
    b = 'constructor',
    s = 'console.log(s)';
x[a][b](s)();
```

Some node projects deploy with a tweaked node runtime that turns off
some `eval` operators, but there are widely used npm modules that use
them carefully.  For example:

*  [Pug][]  generates HTML from templates.
*  [Mathjs][] evaluates closed-form mathematical expressions.

Both generate JavaScript code under the hood, which is dynamically
parsed.  Let's consider two use cases:

*  Pug's code generator is usually called with trusted inputs, e.g.
   `.pug` files authored by trusted developers.
*  Mathjs is often called with untrusted inputs.  If a developer
   wanted to let a user generate an ad-hoc report without having to
   download data into a spreadsheet, they might use Mathjs to parse
   user-supplied arithmetic expressions ([docs][more_secure_eval])
   instead of trying to check that an input is safe to `eval` via
   `RegExp`s.  It is not without risk ([advisory][adv552]) though.

These two uses of code generators fall at either end of a spectrum.
The uses of Pug seem static, all the information is available before
we deploy.  Our Mathjs use case is necessarily dynamic since the
input is not available until a user is in the loop.

Next we discuss ways to recognize and simplify the former, while
double-checking the latter.  On the client, we have no options between
allowing implicit `eval` and banning all uses of `eval`.  There are
fewer compelling use cases on the client since it is harder to
amortize code generation over multiple requests.  On the server, use
of `eval` in the presence of untrusted inputs still needs to be
carefully vetted.  We explore ways to programatically enforce vetting
decisions short of a blanket ban, but turning off `eval` before
accepting untrusted inputs is still the most reliable way to prevent
attackers from using `eval` against you.

[`WebAssembly.compile`]: http://webassembly.org/docs/js/#webassemblycompile
[Pug]: https://pugjs.org/
[Mathjs]: http://mathjs.org/
[more_secure_eval]: http://mathjs.org/examples/advanced/more_secure_eval.js.html
[adv552]: https://nodesecurity.io/advisories/552
