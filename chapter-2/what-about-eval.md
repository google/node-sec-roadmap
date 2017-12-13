# What about `eval`?

Above we've talked about how to controlling what code loads
from the file system, but not what code loads from strings.

The rest of this discussion uses `eval` to refer to any of the `eval`
operator, the `eval` function, `new Function`, `setTimeout(string, dt)`,
`vm.runIn*Context`, `vm.Script.run*`, [`WebAssembly.compile`][] and
other operators that convert strings or bytes into code.

Recall that it is
[difficult to prove code does not `eval`](../chapter-1/threat-RCE.md):

```js
var x = {},
    a = '__proto__',
    b = 'constructor',
    c = '__proto__',
    d = 'constructor',
    s = 'console.log(s)';
x[a][b][c][d](s)();
```

Some node projects deploy with a tweaked node runtime that turns off
some `eval` operators, but there are widely used npm modules that use
them carefully.  For example:

*  [Pug](https://pugjs.org/) generates HTML from templates.
*  [Mathjs](http://mathjs.org/) evaluates
   closed-form mathematical expressions.

Both generate JavaScript code under the hood, which is dynamically
parsed.  Let's consider two use cases:

*  Pug is usually called with trusted inputs.
*  If a developer wanted to let a user generate an ad-hoc report
   without having to download data into a spreadsheet, they might use Mathjs to
   [parse user-supplied arithmetic expressions][mathjs more_secure_eval]
   instead of trying to check that an input is safe to `eval` via `RegExp`s.

These two uses of code generators at either end of a spectrum.
The uses of Pug seem static, all the information is available before
we deploy.  Our Mathjs use case is necessarily dynamic since the
input is not available until a user is in the loop.

Next we discuss ways to recognize and simplify the former, while
double-checking the latter.

[`WebAssembly.compile`]: http://webassembly.org/docs/js/#webassemblycompile
[mathjs more_secure_eval]: http://mathjs.org/examples/advanced/more_secure_eval.js.html
