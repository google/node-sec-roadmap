# Source Content Checks

The node runtime's module loader uses the `_compile` method to actually
turn file content into code thus:

```js
// Run the file contents in the correct scope or sandbox. Expose
// the correct helper variables (require, module, exports) to
// the file.
// Returns exception, if any.
Module.prototype._compile = function(content, filename) {
  content = internalModule.stripShebang(content);

  // create wrapper function
  var wrapper = Module.wrap(content);

  var compiledWrapper = vm.runInThisContext(wrapper, {
```

At the top of that method body, we can check that the content
is on a list of production sources.

The entire process looks like:

1.  Developer develops and tests their app iteratively as normal.
2.  The developer generates a bundle via the dynamic scheme
    outlined above, a static tool like webpack, or some combination.
3.  The bundling tool generates a file with a cryptographic hash
    for each production source.
    We prefer hashing to checking paths for reasons that will become
    apparent later when we discuss `eval`.
4.  The bundle and the hashes are copied to a production server.
5.  The server startup script passes a flag to `node` or `npm start`
    telling the runtime where to look for the production source hashes.
6.  The runtime reads the hashes and combines it with any hashes necessary
    to whitelist any `node` internal JavaScript files that might load
    via `require`.
7.  When a call to `require(x)` reaches `Module.prototype.compile`
    it hashes `content` and checks that the hash is in the allowed set.
    If not, it logs that and, if not in report-only-mode,
    raises an exception.
8.  Normal log collecting and monitoring communicates failures
    to the development team.

This is similar to [Content-Security-Policy][] (CSP) but for server-side
code.  Like CSP, there is an intermediate step that might be useful
between no enforcement and full enforcement: [report only mode][].

[Content-Security-Policy]: https://developers.google.com/web/fundamentals/security/csp/
[report only mode]: https://developers.google.com/web/fundamentals/security/csp/#report-only
