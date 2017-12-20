# Structured Strings

Both of the previously discussed problems, query injection and shell
injection, are facets of a common problem: it is hard to securely
compose strings to send outside the process.  In the first case,
we send a query string to a database via a file descriptor bound to a
network socket or an IPC endpoint.  In the second, we send a string
via a syscall wrapper, to spawn a child process.

## Success Criteria

We can securely compose strings for external endpoints if:

*  Developers routinely use tools to produce structured strings
   that preserve developers' intent even in the face of inputs
   crafted by a skilled attacker, and/or
*  Where developers do not, the backends grant no authority based on
   the structure of the string, and the authority granted ambiently is
   so small as to not be abusable.

Nailing down the definition of *intent* is hard, but here's an example
of how we can in one context.  Consider

```js
"SELECT * FROM T WHERE id=" + f(accountNumber)
```

A reasonable reader would conclude that the author intended:

*  That the result specifies one statement, a select statement.
*  That `f(accountNumber)` specifies only a simple value that
   can be compared to values in the *id* column.

Given that, we can say `function f(x)` preserves intent in that code
if, for any value of `accountNumber`, it throws an exception or
its output following "`SELECT * FROM T WHERE id=`" parses as a
single number or string literal token.



## A possible solution

### Change the world so we can give simple answers to hard questions.

Extend existing APIs so that whenever a developer is composing a
string to send outside the `node` process, they have a template
literal tag based API that is more secure than string concatenation.

Then, we can give developers a simple piece of advice:

> If you're composing a string that will end up outside node, use
> a template tag.

Template tags will have implementation bugs, but fixing one template
tag is easier than fixing many expressions of the form
`("foo " + bar + " baz")`.


### A common style guide for tag implementers.

It would help developers if these template literal tags had some
consistency across libraries.  We've already briefly discussed ways to
make template tags more discoverable and usable when talking about
ways to treat [generated code][synthetic modules] as first class.

We propose a style guide for tag authors.
Others will probably have better ideas as to what it should contain, but
to get a discussion started:

-  Functions that compose or represent a string whose recipient is outside
   the node runtime should accept template tags.
   Examples include `mysql.format` which composes a string of SQL.
-  These functions should return a typed string wrapper.
   For example, if the output is a string of *SQL* tokens,
   then return an instance of:
   ```js
   function SqlFragment(s) {
     if (!(this instanceof SqlFragment)) { return new SqlFragment(s); }
     this.content = String(s);
   }
   SqlFragment.prototype.toString = (() => this.content);
   ```
   Don't re-escape `SqlFragment`s received as interpolation values
   where they make sense.
-  See if you can reuse string wrappers from a library before rolling
   your own to encourage interoperability.
   If a library defines a type representing a fragment of HTML, use that
   as long as your operator can uphold the type's contract.
   For example if the type has a particular security contract
   ([docs][security contract]), make sure that you preserve that
   security contract.
   You may assume that wrapped strings come from a source that upheld
   the contract.
   Producing a value that doesn't uphold its contract when your inputs do
   is a bug, but assuming incorrectly that type contracts hold for your
   inputs is not.
   If you can double check inputs, great!
-  The canonical way to test whether a function was (very probably)
   called as a template tag is
   ```js
   function (a, ...b) {
     if (Array.isArray(a) && Array.isArray(a.raw)
         && Object.isFrozen(a)
         && a.length === b.length + 1) {
       // Treat as template tag.
     }
     // Handle non template tag use.
   }
   ```
-  When a template tag takes options objects, it should
   be possible to curry those before invoking the function as a tag.
   The following passes some environment variables and a working directory
   before the command:
   ```js
   shelljs.exec({ env: ..., cwd: ... })`cat ...`
   ```
-  When a template tag takes a `callback`, the template tag should
   return a function that will receive the callback.
   The following uses a template tag that returns a function that
   takes a callback:
   ```js
   myConnection.query`SELECT ...`(callback)
   ```
-  Where possible, allow indenting multi-line template tags.
   Use the first line with non-whitespace characters as a cue
   when stripping whitespace from the rest of the lines.

## Alternatives

Database abstractions like object-relational mappings are a great way
to get developers out of the messy business of composing queries.

There are still niche use cases like ad-hoc reporting that require
composing queries, and solving the problem for database queries does
not solve it for strings sent elsewhere, e.g. shells.

Builder APIs provide a flexible way to compose structured content.
For example,

```java
  new QueryBuilder()
  .select()
  .innerJoin(...).on(...)
  .columns(...)
  .where(...)
  .orderBy(...)
  .build()
```

The explicit method calls specify the structure of the resulting
string, so controlling parameters doesn't grant control of sentence
structure, and control of one parameter doesn't allow reinterpreting
part of the query specified by an uncontrolled parameter.

In JavaScript we prefer tagged templates to builders.  These APIs can
be syntactically heavy and developers have to discover and learn them.
We hope that adoption with template tags will be easier because:

*  Tagged templates are syntactically lighter so easier to write.
*  Someone unfamiliar with the API, but familiar with the query language, will
   have to do less work to leverage the one to understand the other making
   tagged templates easier to read and adapt for one's own work.
*  Builder APIs have to treat nested sub-languages (e.g. URLs in HTML)
   as strings unless there is a builder API for the sub-language.


[security contract]: https://github.com/google/safe-html-types
[synthetic modules]: ../chapter-2/synthetic-modules.html
