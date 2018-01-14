# Remote Code Execution

Remote code execution occurs when the application interprets an
untrustworthy string as code.  When `x` is a string, `eval(x)`,
`Function(x)`, and `vm.runIn*Context(x)` all
invoke the JavaScript engine's parser on `x`.  If an attacker controls
`x` then they can run arbitrary code in the context of the CommonJS
module or `vm` context that invoked the parser.

Sandboxing can help but widely available sandboxes have
[known workarounds][denicola-vm-run] though the [frozen realms][]
proposal aims to change that.

It is harder to execute remote code in server-side JavaScript.
`this[x][y] = "javascript:console.log(1)"` does not cause code to
execute for nearly as many `x` and `y` as in a browser.

These operators are probably rarely used *explicitly*, but
many operators that convert strings to code when given a string
do something else when given a `Function` instance.
`setTimeout(x, 0)` is safe when `x` is a function.

*  [Grepping](../appendix/experiments.md#grep-problems) shows the rate
   in the top 100 modules and their transitive dependencies by simple
   pattern matching after filtering out comments and string content.
   This analysis works on most modules, but fails to distinguish
   safe uses of `setTimeout` for example from unsafe.
*  A [type based analysis](../appendix/experiments.md#jsconf) can
   distinguish between those two, but the tools we tested don't
   deal well with mixed JavaScript and TypeScript inputs.

Even if we could reliably identify places where strings are
*explicitly* converted to code for the bulk of npm modules,
it is more difficult in JavaScript to statically prove that
code does not *implicitly* invoke a parser than in other
common backend languages.

```js
// Let x be any value not in
// (null, undefined, Object.create(null)).
var x = {},
// If the attacker can control three strings
    a = 'constructor',
    b = 'constructor',
    s = 'console.log(s)';
// and trick code into doing two property lookups
// they control, a call with a string they control,
// and one more call with any argument
x[a][b](s)();
// then they can cause any side-effect achievable
// solely via objects reachable from the global scope.
// This includes full access to any exported module APIs,
// all declarations in the current module, and access
// to builtin modules like child_process, fs, and net.
```

Filtering out values of `s` that "look like JavaScript" as they reach
server-side code will probably not prevent code execution.
[Yosuke Hasegawa][Yosuke] how to reencode arbitrary JavaScript using
only 6 punctuation characters, and that number may
[fall to 5][Masato].  ["Web Application Obfuscation"][obfusc] by
Heiderich et al. catalogues ways to bypass filtering.

`eval` also allows remote-code execution in Python, PHP, and
Ruby code, but in those languages `eval` operators are harder to
mention implicitly which means uses are easier to check.

It is possible to dynamically evaluate strings even in statically
compiled languages, for example, [JSR 223][] and
[`javax.compiler`][dynjava] for Java.  In statically compiled
languages there is no short implicit path to `eval` and it is not
easier to `eval` an untrusted input than to use an intepreter that is
isolated from the host environment.

We consider remote code execution in Node.js lower frequency than for
client-side JavaScript without a Content-Security-Policy but higher
than for other backend languages.  We consider the severity the same
as for other backend languages.  The serverity is higher than for
client-side JavaScript because backend code often has access to more
than one user's data and privileged access to other backends.

[denicola-vm-run]: https://gist.github.com/domenic/d15dfd8f06ae5d1109b0
[frozen realms]: https://github.com/tc39/proposal-frozen-realms
[Yosuke]: https://news.ycombinator.com/item?id=4370098
[Masato]: https://syllab.fr/projets/experiments/xcharsjs/5chars.pipeline.html
[obfusc]: https://www.amazon.com/Web-Application-Obfuscation-Evasion-Filters/dp/1597496049
[JSR 223]: https://docs.oracle.com/javase/8/docs/technotes/guides/scripting/prog_guide/api.html
[dynjava]: https://www.ibm.com/developerworks/library/j-jcomp/index.html
