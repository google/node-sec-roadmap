# Structured Strings

Both of the previously discussed problems, query injection and shell
injection, are facets of a common problem: it is hard to securely
compose strings to send outside the process.  In the first case,
we send a query string to a database via a file descriptor bound to a
network socket or an IPC endpoint; in the other, we send a string
via a syscall wrapper, to spawn a child process.

## Success Criteria

We can securely compose strings for external endpoints if:

*  Developers routinely use tools to produce structured strings
   that preserve the developers' intent even in the face of
   untrusted inputs, and/or
*  Where developers do not, the backends grant no authority based on
   the structure of the string, and the authority granted ambiently is
   so small as to not be abusable.

Nailing down the definition of *intent* is hard, but here's an example
of how we can in one context.
A reasonable reader would conclude that the author of
`"SELECT * FROM T WHERE id=" + f(accountNumber)`
intended:

*  That the string specify only one statement, a select statement.
*  That `f(accountNumber)` specify only a simple value that is then
   compared to values in the `id` column of table `T`.

Given that, we can say `function f(x)` preserves intent in that code
if, for any value of `accountNumber`, its output following a
comparison operator (`=`) will parse as a single number or string
literal token.



## A possible solution

Extend existing APIs so that whenever a developer is composing a
string to send outside the `node` process, they have a template
literal tag based API that is more secure than string concatenation.

Then, we can give developers a simple piece of advice:

> If you're composing a string that will end up outside node, use
> a template tag.

Template tags will have implementation bugs, but fixing one template
tag is easier than fixing many expressions of the form
`("foo " + bar + " baz")`.


### A common style guide for tag implementers

It would help developers if these template literal tags had some
consistency across libraries.  We've already briefly discussed ways to
make template tags more discoverable and usable when talking about
ways to treat [generated code][synthetic modules] as first class.

We propose a style guide for tag authors.
Others will probably have better ideas as to what it should contain, but
as a stalking horse:

-  Functions that compose or represent a string whose recipient is outside
   the node runtime should accept a template tags.
   Examples include `mysql.format` which composes a string of SQL.
   These functions should represent a typed string wrapper.
   For example, if the output is a string of `Sql`, then return an instance
   of:
   ```js
   function SqlFragment(s) {
     if (!(this instanceof SqlFragment)) { return new SqlFragment(s); }
     this.content = String(s);
   }
   SqlFragment.prototype.toString = (() => this.content);
   ```
   and don't re-escape `SqlFragment`s received as interpolation values
   where they make sense.
-  See if you can reuse a string wrappers from a library before rolling
   your own to encourage interoperability.
   If a library defines a type representing a fragment of HTML, use that
   as long as your operator can uphold the types contract.
   For example if the type has a particular [security contract][],
   make sure that you preserve that security contract.
   You may assume that wrapped strings come from a source that upheld
   the contract before creating the strings.
   Producing a value that doesn't uphold its contract when your inputs do
   is a bug, but assuming incorrectly that type contracts hold is not.
   If you can double check inputs, great!
-  Functions that compose a string and ship it outside the `node` process
   should operate as template tags.
   Examples include `connection.query` and `shell.exec`.
-  The canonical way to test whether a function is (very probably)
   being used as a template tag is
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
-  When a template tag takes options objects or callbacks, it should
   be possible to curry those before invoking the function as a tag.
   For example, `connection.query(callback)` returns a function that
   will execute a query with that callback so that
   ```js
   connection.query(callback)`SELECT ...`
   ```
   sends the composed SELECT statement and executed `callback` when
   the result set is received.


### The wonderful thing about SQL

There are many different dialects of SQL, many with subtly different
commenting and string escaping conventions.  Its unlikely that a
single SQL escaping library is going to correctly compose SQL for all
SQL databases out there, but we can still provide API compatible tags.

For any SQL API, it would be nice if

```js
const sql_api = require(anySqlApiModuleIdentifier);

let fragment = sql_api.sql`SELECT ...` // -> a type sql fragment

connection = sql_api.connect(...);

connection.query(callback)`SELECT ...`  // is equivalent to
connection.query(callback)(fragment)
// is equivalent to the normal way to send the query encapsulated
// by fragment with callback as the result.

// and similarly for update operators.
```


## Alternatives

Database abstractions like object-relational mappings are a great way to get developers
out of the messy business of composing queries.

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


[security contract]: https://github.com/google/safe-html-types
[synthetic modules]: ../chapter-2/synthetic-modules.html
