# Statically eliminating `eval`

Pug provides a flexible API to load Pug templates from `.pug` files
that `eval`s the generated code ([code][pug-eval]),
and a command line interface for precompiling Pug files.

Let's ignore those and imagine ways to allow a Pug user to
compile a Pug template that makes the static nature apparent
even to an analysis which doesn't make assumptions about the
contents of `.pug` files.

```js
const pug = require('pug');

exports.myTemplate = pug.lang`
doctype html
html
  head
    ...`;
```

This code snippet uses a [tagged template literal][] to allow Pug
template code to appear inline in a JavaScript file.

Rather than loading a `.pug` file, we have declared it in JavaScript.

Imagine further that `pug.lang` runs the compiler, but instead of
using `new Function(...)` it uses some new module API

```js
require.synthesize(generatedCode)
```

which could manufacture a `Module` instance with the generated code and
install the module into the cache with the input hash as its filename.

When [bundling](bundling.md), we could dump the content of synthesized
modules, and, when the bundle loads in production, pre-populate
the module cache.  When the `pug.lang` implementation asks the
module loader to create a module with the content between
<code>&#96;...&#96;</code> it would find a resolved module ready but not
loaded.  If a module is already in the cache, `Module` skips the
additional content checks.

The Node runtime function, `makeRequireFunction`
([code][makeRequireFunction]), defines a `require` for each module
that loads modules with the current module as the parent.  That would
also have to define a module specific `require.synthesize` that does
something like:

```js
  function synthesize(content) {
    content = String(content);
    // Hashing gives us a stable identifier so that we can associate
    // code inlined during bundling with that loaded in production.
    const hash = crypto
        .createHash('sha512')
        .update(content, 'utf8')
        .digest();
    // A name that communicates the source while being
    // unambiguous with any actual file.
    const filename = '/dev/null/synthetic/' + hash;
    // We scope the identifier so that it is clear in
    // debugging trace that the module is synthetic and
    // to avoid leading existing tools to conclude that
    // it is available via registry.npmjs.org.
    const id = '@node-internal-synthetic/' + hash;
    const cache = Module._cache;
    let syntheticModule = cache[filename];
    if (syntheticModule) {
      // TODO: updateChildren(mod, syntheticModule, true);
    } else {
      cache[filename] = syntheticModule = new Module(id, mod);
      syntheticModule.loaded = true;
      syntheticModule._compile(content, filename);
    }
    // TODO: dump the module if the command line flags specify
    // a synthetic_node_modules/ output directory.
    return syntheticModule;
  }

  require.synthesize = synthesize;
```

Static analysis tools often benefit from having a whole program
available.  Humans can reason about external files, like `.pug` files,
but static analysis tools often have to be unsound, or assume the
worst.  Synthetic modules may provide a way to move a large chunk of
previously unanalyzable code into the domain of what static analysis
tools can check.

This scheme, might be more discoverable if code generator authors
adopted some conventions:

*  If a module defines `exports.lang` it should be usable as a
   template tag.
*  If that same function is called with an option map instead
   of as a template tag function, then it should return a function
   to enable usages like
   ```js
   pug.lang(myPugOptionMap)`
     doctype html
     ...`
   ```
*  If the first line starts with some whitespace, all subsequent
   lines have that same whitespace as a prefix, and the language
   is whitespace-sensitive, then strip it before processing.
   This would allow indenting inline DSLs within a larger
   JavaScript program.

We discuss template tag usability concerns in more detail later when
discussing [library tweaks][library].

This proposal has one major drawback: we still have to trust the code
generator.  Pug's code generator looks well structured, but reasoning
about all the code produced by a code generator is harder than
reasoning about one hand-written module.  The [frozen realms][] proposal
restricts code to a provided API like
`vm.runInNewContext` aimed to.  If Pug, for example, chose to load its
code in a sandbox, then checking just the provided context would give
us confidence about what generated code could do.  In some cases, we
might be able to move code generator outside the
[*trusted computing base*][TCB].

[tagged template literal]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_template_literals
[pug-eval]: https://github.com/pugjs/pug/blob/926f7c720112cac76cfedb003e25e9f43d3a1767/packages/pug/lib/index.js#L261-L263
[library]: ../chapter-7/libraries.md
[makeRequireFunction]: https://github.com/nodejs/node/blob/8f5040771475ca5435b6cb78ab2ebce7447afcc1/lib/internal/module.js#L5
[frozen realms]: https://github.com/tc39/proposal-frozen-realms
[TCB]: https://en.wikipedia.org/wiki/Trusted_computing_base
