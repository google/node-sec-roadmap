# Dynamically bounding `eval`

If we could provide an API that was available statically, but not dynamically
we could double-check uses of `eval` operators.

```js
// API for allowing some eval
var prettyPlease = require('prettyPlease');
// Carefully reviewed JavaScript generating code
var codeGenerator = require('codeGenerator');

let compile;

prettyPlease.mayI(
    module,
    (evalPermission) => {
      compile = function (source) {
        const js = codeGenerator.generateCode(source);
        return prettyPlease.letMeEval(
            evalPermission,
            js,
            () => ((0, eval)(js)));
      };
    });

exports.compile = compile;
```

The `prettyPlease` module cannot be pure JavaScript since only
C++ can take advantage of [CodeGeneration callbacks][] the way
[CSP does][CSP callback] on the client, but the definition would be roughly:

```js
// prettyPlease module
(() => {
  const _PERMISSIVE_MODE = 0;  // Default
  const _STRICT_MODE = 1;
  const _REPORT_ONLY_MODE = 2;

  const _MODE = /* From command line arguments */;
  const _WHITELIST = new Set(/* From command line arguments */);

  const _VALID_PERMISSIONS = new WeakSet();
  const _EVALABLE_SOURCES = new Map();

  if (_MODE !== _PERMISSIVE_MODE) {
    // Pseudocode: the code-generation callback installed when the
    // JavaScript engine is initialized.
    function codeGenerationCheckCallback(context, source) {
      // source must be a v8::Local<v8::string> or ChakraCore equivalent
      // so no risk of polymorphing
      if (_EVALABLE_SOURCES.has(source)) {
        return true;
      }
      console.warn(...);
      return _MODE == _REPORT_ONLY_MODE;
    }
  }

  // requestor -- the `module` value in the scope of the code requesting
  //      permissions.
  // callback -- called with the generated permission whether granted or
  //      not.  This puts the permission in a parameter name making it
  //      much less likely that an attacker who controls a key to obj[key]
  //      can steal it.
  module.mayI = function (requestor, callback) {
    const id = String(requestor.id);
    const filename = String(requestor.filename);
    const permission = Object.create(null);  // Token used for identity
    // TODO: Needs privileged access to real module cache so a module
    // can't masquerade as another by mutating the module cache.
    if (_MODE !== _PERMISSIVE_MODE
        && requestor === require.cache[filename]
        && _WHITELIST.has(id)) {
      _VALID_PERMISSIONS.add(permission);
      // Typical usage is to request permission once during module load.
      // Removing from whitelist prevents later bogus requests after
      // the module is exposed to untrusted inputs.
      _WHITELIST.delete(id);
    }
    return callback(permission);
  };

  // permission -- a value received via mayI
  // sourceToEval -- code to eval.  The code generation callback will
  //                 expect this exact string as its source.
  // codeThatEvals -- a callback that will be called in a scope that
  //                  allows eval of sourceToEval.
  module.letMeEval = function (permission, sourceToEval, codeThatEvals) {
    sourceToEval = String(sourceToEval);
    if (_MODE === _PERMISSIVE_MODE) {
      return codeThatEvals();
    }

    if (!_VALID_PERMISSIONS.has(permission)) {
      console.warn(...);
      if (_MODE !== _REPORT_ONLY_MODE) {
        return codeThatEvals();
      }
    }

    const countBefore = _EVALABLE_SOURCES.get(sourceToEval) || 0;
    _EVALABLE_SOURCES.set(sourceToEval, countBefore + 1);
    try {
      return codeThatEvals();
    } finally {
      if (countBefore) {
        _EVALABLE_SOURCES.set(sourceToEval, countBefore);
      } else {
        _EVALABLE_SOURCES.delete(sourceToEval);
      }
    }
  };
})();
```

and the `eval` operators would check that their argument is in the global
set.

As long as we can prevent reflective access to `evalPermissions`
we have constrained what can be `eval`ed.
If `evalPermission` is a function parameter, then only `arguments`
aliases it, so functions that do not mention the special name
`arguments` may safely receive one.
Most functions do not.
Before whitelisting a module, a reviewer would be wise to check for
any use of `arguments`, and for any escape of permissions or `module`.

`evalPermission` is an opaque token --- only its reference identity
is significant, so we can check membership in a `WeakSet` without
risk of forgery.

This requires API changes to existing modules that dynamically use
`eval`, but the changes should be additive and straightforward.

It also allows project teams and security specialists to decide on
a case-by-case basis, which modules really need dynamic `eval`.

As with synthetic modules, frozen realms may provide a way to further
restrict what dynamically loaded code can do.  If you're trying to
decide whether to trust a module that dynamically loads code, you have
more ways to justifiably conclude that it's safe if the module loads
into a sandbox restricts to a limited frozen API.

[CodeGeneration callbacks]: https://cs.chromium.org/chromium/src/third_party/WebKit/Source/bindings/core/v8/V8Initializer.cpp?rcl=ed08e77a52d977fdb8f4c2a0b27e3d5a73019a57&l=626
[CSP callback]: https://cs.chromium.org/chromium/src/third_party/WebKit/Source/bindings/core/v8/V8Initializer.cpp?rcl=ed08e77a52d977fdb8f4c2a0b27e3d5a73019a57&l=352
