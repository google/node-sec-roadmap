# Unintended Require

If an attacker controls the `x` in `require(x)` then they can cause
code to load that was not intended to run on the server.

Our high-level, informal security argument for web applications looks
like:

1.  All code producing content for, and loaded into *example.com*
    is written or vetted by developers employed by *example.com*.
2.  Those developers have the tools and support to do a good job, and
    organizational measures filter out those unwilling or unable to
    do a good job.
3.  Browsers enforce the same origin policy, so *example.com*'s code
    can make sure all access by third parties to data held on behalf
    of end users goes through *example.com*'s servers where
    authorization checks happen.
4.  Therefore, end users can make informed decisions about the degree
    of trust they extend to *example.com*.

Even if the first two premises are true, but production servers load
code that wasn't intended to run in production, then the conclusion
does not follow.  Developers do not vet test code the same way they
do production code and ought not have to.

This vulnerability may be novel to CommonJS-based module linking
(though we are not the first to report it ([details][prior art])) so we
discuss it in more depth than other classes of vulnerability.  Our
frequency and severity guesstimates have a high level of uncertainty.


## Dynamic `require()` can load non-production code

`require` only loads from the file-system under normal configurations
even though [CommonJS][modules spec] leaves "unspecified
whether modules are stored with a database, file system, or factory
functions, or are interchangeable with link libraries."

Even though, as-shipped, `require` only loads from the file-system, a
common practice of copying `node_modules` to the server makes
unintended require a more severe problem than one might expect.  Test
code often defines mini APIs that intentionally disable or circumvent
production checks, so causing test code to load in production can make
it much easier to escalate privileges or turn a limited code execution
vulnerability into an arbitrary code execution vulnerabilities.


## Availability of non-production code in `node_modules`

There are many modules `$m` such that `npm install "$m"` places test
or example files under `node_modules/$m`.

[Experiments](../appendix/experiments.md#test_code) show that, of the
top 108 most commonly used modules, 50 (46.30%) include test or
example code.  Some of these modules, like `mocha`, are most
often loaded as dev dependencies, but `npm install --only=prod`
will still produce a `node_modules` directory that has test and
example code for most projects.


## Non-production code differs from production code.

We need to keep test code from loading in production.

Good developers do and should be able to do things in test code that
would be terrible ideas in production code.  It is not uncommon to
find test code that:

-  changes global configuration so that they can run tests under
   multiple different configurations.
-  defines methods that intentionally break abstractions so they
   can test how gracefully production code deals with marginal inputs.
-  parses test cases specified in strings and pass parts onto powerful
   reflective operators and `eval`-like operators.
-  `require`s modules specified in test case strings so they can
   run test cases in the context of plugins.
-  breaks private/public API distinctions to better interrogate
   internals.
-  disables security checks so they can test how gracefully
   a subcomponent handles dodgy inputs.
-  calls directly into lower-level APIs that assume that higher
   layers checked inputs and enforced access controls.
-  includes in output sensitive internal state (like PRNG seeds) to
   aid a developer in reproducing or tracking down the root cause of
   a test failure.
-  logs or include in output information that would be sensitive
   if the code connected to real user data instead of a test database.
-  resets PRNG seeds to fixed values to make it easier to reproduce
   test failures.
-  adds additional "God mode" request handlers that allow a developer
   to interactively debug a test server.

These are not security problems when test environments neither access
real user data nor receive untrusted inputs.

## Unintended Require can activate non-production code

The primary vector for this vulnerability is dynamic code loading:
calling `require(...)` with an argument other than a literal string.

To assess the severity of this issue, we [examined](../appendix/experiments.md)
the 108 most popular npm modules.

34 of the top 108 most popular npm modules (30%) call `require(...)`
without a literal string argument or have a non-test dependency that
does.  This is after imperfect heuristics to filter out non-production
code.  If we assume, conservatively, that uses of `require` that are
not immediate calls are dynamic load vectors, then the proportion
rises to 50%.  See [appendix](../appendix/experiments.md#dynamic_load).

Below are the results of a manual human review of dynamic loads in
popular npm modules.  There seem to be few clear vulnerabilities among
the top 108 modules, but the kind of reasoning required to check this
is not automatable; note the use of phrases like "developers probably
won't" and "the module is typically used to".

Determining which dynamic loads are safe among the long tail of less
widely used modules would be difficult.

----

Some dynamic loads are safe.  Jade, a deprecated version of PugJS, does

```js
function getMarkdownImplementation() {
  var implementations = ['marked', 'supermarked',
                         'markdown-js', 'markdown'];
  while (implementations.length) {
    try {
      require(implementations[0]);
```

This is not vulnerable.  It tries to satisfy a dependency by
iteratively loading alternatives until it finds one that is available.

Babel-core v6's file transformation module ([code][babel-core dyn load])
loads plugins thus:

```js
var parser = (0, _resolve2.default)(parserOpts.parser, dirname);
if (parser) {
  parseCode = require(parser).parse;
```

This looks in an options object for a module identifier.  It's
unlikely that this particular code in babel is exploitable since
developers probably won't let untrusted inputs specify parser options.

The popular colors module ([code][colors dyn load]) treats the argument
to `setTheme` as a module identifier.

```js
colors.setTheme = function (theme) {
  if (typeof theme === 'string') {
    try {
      colors.themes[theme] = require(theme);
```

This is unlikely to be a problem since the module is typically used to
colorize console output.  HTTP response handling code will probably
not load `colors` so an untrusted input will probably not reach
`colors.setTheme`.
If an attacker can control the argument to `setTheme` then they can
load an arbitrary JavaScript source file or C++ addon.

The popular browserlist module ([code][browserlist dyn load]) takes
part of a query string and treats it as a module name:

```js
  {
    regexp: /^extends (.+)$/i,
    select: function (context, name) {
      if (!context.dangerousExtend) checkExtend(name)
      // eslint-disable-next-line security/detect-non-literal-require
      var queries = require(name)
```

Hopefully browser list queries are not specified by untrusted inputs, but
if they are, an attacker can load arbitrary available source files since
`/(.+)$/` will match any module identifier.

The popular express framework loads file-extension-specific code
as needed.  If express views are lazily initialized based on a portion
of the request path without first checking that the path should have a
view associated, then the following runs ([code][express dyn load]):

```js
if (!opts.engines[this.ext]) {
  // load engine
  var mod = this.ext.substr(1)
  debug('require "%s"', mod)

  // default engine export
  var fn = require(mod).__express
```

This would seem to allow loading top-level modules by requesting a
view name like `foo.toplevelmodule`, though not local source files
whose identifiers must contain `.` and `/`.  Loading top-level modules
does not, by itself, allow loading non-production code, so this is
probably not vulnerable to this attack.  It may be possible to use a
path like `/base.\foo\bar` to cause `mod = "\\foo\\bar"` which may
allow arbitrary source files on Windows, but it would only allow
loading the module for initialization side effects unless it
coincidentally provides significant abusable authority under
`exports.__express`.

----

This analysis suggests that the potential for exploiting unintended
require is low in projects that only use the 100 most popular modules,
but the number and variety of dynamic `require()` calls in the top 108
modules suggests potential for exploitable cases in the top 1000
modules, and we know of no way to automatically vet modules for UIR
vulnerabilities.

## Unintended require can leak information

[Fernando Arnaboldi][diff fuzz] showed that unintended requires can
leak sensitive information if attackers have access to error messages.

> ```sh
> # node -e
> "console.log(require('/etc/shadow'))"
> ```
>
> ...
>
> The previous example exposes the first line of
> /etc/shadow, which contains the encrypted root password.

See also [exfiltration][EXF].


[babel-core dyn load]: https://github.com/babel/babel/blob/cb8c4172ef740aa562f0873d602d800c55e80c6d/packages/babel-core/src/transformation/file/index.js#L421-L424
[colors dyn load]: https://github.com/Marak/colors.js/blob/9f3ace44700b8e705cb15be4767845c311b3ae11/lib/colors.js#L135-L138
[browserlist dyn load]: https://github.com/ai/browserslist/blob/3e7ed2431d781ce0ff7eade1e2b24780c592b50e/index.js#L776-L780
[express dyn load]: https://github.com/expressjs/express/blob/351396f971280ab79faddcf9782ea50f4e88358d/lib/view.js#L81
[prior art]: https://github.com/nodesecurity/eslint-plugin-security/blob/master/README.md#detect-non-literal-require
[diff fuzz]: https://www.blackhat.com/docs/eu-17/materials/eu-17-Arnaboldi-Exposing-Hidden-Exploitable-Behaviors-In-Programming-Languages-Using-Differential-Fuzzing-wp.pdf
[EXF]: threat-EXF.md
[modules spec]: http://wiki.commonjs.org/wiki/Modules/1.1
