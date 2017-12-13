# Dynamism when you need it

## Background

Node.js code is composed of CommonJS modules that are linked together
by the builtin `require` function, or [`import`][import-js] statements
(used by [typescript][import-ts]) that typically transpile to `require`
(modulo [experimental features][esm]).

`require` itself calls [`Module._load`][] to resolve and load code.
["The Node.js Way"][FKS] explains this flow well.

Unlike `import`, `require` is dynamic: a runtime value can specify
the name of a module to load.  (The EcmaScript committee is
considering a [dynamic `import` operator][import-op-strawman], but we
have not included that in this analysis.)


This dynamism is powerful and flexible and enables varied use cases
like the following:

*   Lazy loading.  Waiting to load a dependency until it is definitely needed.
    ```js
    const infrequentlyUsedAPI = (function () {
      const dependency = require('dependency');
      return function infrequentlyUsedAPI() {
        // Use dependency
      };
    }());
    ```
*   Loading plugins based on a configuration object.
    ```js
    function Service(config) {
      (config.plugins || []).forEach(
          (pluginName) => {
            require(pluginName).initPlugin(this);
          });
    }
    ```
*   Falling back to an alternate service provider if the first choice
    isn't available:
    ```js
    const KNOWN_SERVICE_PROVIDERS = ['foo-widget', 'bar-widget'];
    const serviceProviderName = KNOWN_SERVICE_PROVIDERS.find(
       (name) => {
         try {
           require.resolve(name);
           return true;
         } catch (_) {
           return false;
         }
       });
    const serviceProvider = require(serviceProviderName);
    ```
*   Taking advantage of an optional dependency if it is available.
    ```js
    let optionalDependency = null;
    try {
      optionalDependency = require('optionalDependency');
    } catch (_) {
      // Oh well.
    }
    ```
*   Loading a handler for a runtime value based on a naming convention.
    ```js
    function handle(request) {
      const handlerName = request.type + '-handler';  // Documented convention
      let handler;
      try {
        handler = require(handlerName);
      } catch (e) {
        throw new Error(
            'Expected handler ' + handlerName
            + ' for requests with type ' + request.type);
      }
      return handler.handle(request);
    }
    ```
*   Introspecting over module metadata.
    ```js
    const version = require('./package.json').version;
    ```

`require` could load the output of code generators by synthesizing a
`package.json` but this doesn't seem to be common in practice.

During rapid development, [file-system monitors][nodemon] can restart
a node project when source files change, and the application stitches
itself together without the complex compiler and build system
integration that statically compiled languages use to do incremental
recompilation.


## Problem

Threats: [DEX][] [RCE][] [UIR][]

The `node_modules` directory does not keep production code separate
from test code.  If test code can be `require`d in production, then
an attacker may find it far easier to execute a wide variety of other
attacks.  See [UIR][] for more details on this.

Node applications rely on dynamic uses of `require` and changes that
break any of these use cases would require coordinating large scale
changes to existing code, tools, and development practices threatening
[developer experience][DEX].

Requiring developers to pick and choose which source files are
production and which are test would either:

*  Require them to scrutinize source files not only for their project
   but also for deep dependencies with which they are unfamiliar
   leading to poor developer experience.
*  Whitelist without scrutiny leading to the original security problem.
*  Lead them to not use modules to solve problems and instead roll their
   own leading to poor developer experience, and possibly additional
   security problems.

We need to ensure that only source code written with production
constraints in mind loads in production without increasing the burden
on developers.

When the behavior of code in production is markedly different from that
on a developer's workstation, developers lose confidence that they
can avoid bugs in production by testing locally which may lead
to poor developer experience and lower quality code.


## Success Criteria

We would successfully address abuse of `require` if

*  Untrusted inputs could not cause `require` to load a
   non-production source file,
*  and/or no non-production source files are reachable by
   `require`,
*  and/or loading a non-production source file has no adverse effect.

and we would successfully prevent abuse of `eval`, `new Function`
and related operators if

*  Untrusted inputs cannot reach an `eval` operator,
*  and/or untrusted inputs that reach them cause no adverse affects,
*  and/or security specialists could whitelist uses of `eval` operators
   that are necessary for the functioning of the larger
   system and compatible with the system's security goals.

In both cases, converting dynamic operators to static before untrusted
inputs reach the system reduces the attack surface.  Requiring
large-scale changes to existing npm modules or requiring large scale
rewrites of code that uses using them constitutes a failure per
[DEX][].


## Current practices

Some development teams use [webpack][] or similar tools originally
developed for client-side code to statically bundle server-side
modules, and provide flexible transpilation pipelines.  That's a
great way to do things, but solving security problems only for teams
with development practices mature enough to deploy via webpack risks
preaching to the choir.

Webpack, in its minimal configuration, does not attempt to skip
test files ([experiment code][webpack-experiment]).
Teams with an experienced webpack user can use it to great effect, but
it is not an out-of-the-box solution.

Webpacking does not prevent calls to `require(...)` with unintended
arguments, but greatly reduces the chance that they will load
non-production code.  As long as the server process cannot read
JS files other than those in the bundle, then a webpacked server
is safe from [UIR][].  This may not be the case if the production
machine has npm modules globally installed, and the server process
is not running in a [chroot jail][].


## A Possible Solution

We present one possible solution to demonstrate that tackling this
problem is feasible.

If we can compute the entire set of `require`-able sources when
dealing only with inputs from trusted sources, then we can
ensure that the node runtime only loads those sources even when
exposed to untrusted inputs.

We propose these changes:

*  A two phase approach to prevent abuse of `require`.
   1. Tweaks to the node module loader that make it easy to
      [dynamically bundle](bundling.md) a release candidate.
   2. Tweaks to the node module loader in production to restrict
      code loads based on [source content hashes](source-contents.md)
      from the bundling phase.
*  Two different strategies for preventing abuse of
   [`eval`](what-about-eval.md).
   *  JavaScript idioms that can allow many uses of `eval` to
      [load as modules](synthetic-modules.md) and to bundle as above.
   *  Using JavaScript engine callbacks to
      [allow uses of `eval`](bounded-eval.md) by approved modules.

[DEX]: ../chapter-1/threat-DEX.md
[RCE]: ../chapter-1/threat-RCE.md
[UIR]: ../chapter-1/threat-UIR.md
[webpack]: https://webpack.js.org/
[Symbol]: (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
[import-js]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
[import-ts]: https://www.typescriptlang.org/docs/handbook/modules.html#import
[`Module._load`]: https://github.com/nodejs/node/blob/0fdd88a374e23e1dd4a05d93afd5eb0c3b080fd5/lib/module.js#L449
[FKS]: http://fredkschott.com/post/2014/06/require-and-the-module-system/
[esm]: https://nodejs.org/api/esm.html#esm_ecmascript_modules
[Content-Security-Policy]: https://developers.google.com/web/fundamentals/security/csp/
[nodemon]: https://nodemon.io/
[import-op-strawman]: https://github.com/tc39/proposal-dynamic-import
[chroot jail]: https://help.ubuntu.com/community/BasicChroot
[webpack-experiment]: https://github.com/google/node-sec-roadmap/tree/master/chapter-2/experiments/webpack-compat
