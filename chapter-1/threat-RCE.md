# Remote Code Execution

Remote code execution occurs when the application interprets an
untrustworthy string as code.  When `x` is a string, `eval(x)`,
`setTimeout(x, 0)`, `Function(x)`, and `vm.runIn*Context(x)` all
invoke the JavaScript engine's parser on `x`.  If an attacker controls
`x` then they can run arbitrary code in the context of the CommonJS
module or `vm` context that invoked the parser.  Even sandboxed
operators often have [known workarounds][denicola-vm-run].

It is harder to execute remote code in server-side JavaScript.
`this[x][y] = "javascript:console.log(1)"` does not cause code to
execute for nearly as many `x` and `y` as in a browser.

These operators are probably rarely used *explicitly*, but
many operators that convert strings to code when given a string
do something else when given a `Function` instance.
`setTimeout(x, 0)` is safe when `x` is a function.

*  [Grepping](../appendix/README.md#grep-problems) shows the rate
   in the top 100 modules and their transitive dependencies by simple
   pattern matching after filtering out comments and string content.
   This analysis works on most modules, but fails to distinguish
   safe uses of `setTimeout` for example from unsafe.
*  A [type based analysis](../appendix/README.md#jsconf) can
   distinguish between those two, but existing tools don't
   deal well with mixed JavaScript and TypeScript inputs.

Even if we could reliably identify places where strings are
*explicitly* converted to code for the bulk of npm modules,
it is more difficult in JavaScript to statically prove that
code does not *implicitly* invoke a parser than in other
common backend languages.

```js
var x = {},
    a = '__proto__',
    b = 'constructor',
    c = '__proto__',
    d = 'constructor',
    s = 'console.log(s)';
x[a][b][c][d](s)();
```

Uses of `eval` can be easily found in JavaScript, Python, PHP, and
Ruby code, but in JavaScript a series of square brackets with keys
controlled by an attacker allows access to an `eval`-like operator.

It's possible in [dynamically compile][dynjava] strings even in
statically compiled languages but it is far easier for a developer to
write a parser for a domain-specific language with at least some
isolation from the larger app so attacker-controlled strings reach
compilers much less frequently.

[denicola-vm-run]: https://gist.github.com/domenic/d15dfd8f06ae5d1109b0
[dynjava]: https://www.ibm.com/developerworks/library/j-jcomp/index.html
