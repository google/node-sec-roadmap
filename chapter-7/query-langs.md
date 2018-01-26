# Query injection

Threats: [QUI][]

One piece of simple advice to avoid [query injection attacks][QUI] is
"just use [prepared statements][]."

This is good advice, and the [`mysql`][] library has a
solid, well-documented API for producing secure prepared statements.

Developers could do

```js
const mysql = require('mysql');
...
connection.query(
    'SELECT * FROM T WHERE x = ?, y = ?, z = ?',
    [                          x,     y,     z],
    callback);
```

which is secure since `.query` calls `mysql.format` under the hood
to escape `x`, `y`, and `z`.  Enough developers still do

```js
connection.query(
    "SELECT * FROM T WHERE x = '" + x + "', y = '" + y + "', z='" + z + "'",
    callback);
```

to make query injection a real problem.


Developers may not know about prepared statements, but prepared
statements have other problems:

*  They rely on a **correspondence between positional parameters**
   and the '`?`'s placeholders that they fill.  When a prepared statement
   has more substitutions than fit in a reader's working memory, they
   have to look back and forth between the prepared statement, and the
   parameter list.
*  Prepared statements do not make it easy to **compose a query** from
   simpler query fragments.  It's not easy to compute the `WHERE`
   clause separately from the result column set and then combine the
   two into a query without resorting to string concatenation
   somewhere along the line.


## Template literals

JavaScript has a rarely used feature that lets us get the best of
both worlds.


```js
connection.query`SELECT * FROM T WHERE x = ${x}, y = ${y}, z = ${z}`(callback)
```

uses a [tagged template literal][] to allow inline expressions in SQL
syntax.

> A more advanced form of template literals are tagged template
> literals. Tags allow you to parse template literals with a
> function. The first argument of a tag function contains an array of
> string values. The remaining arguments are related to the
> expressions. In the end, your function can return your manipulated
> string (or it can return something completely different ...).

The code above is almost equivalent to

```js
connection.query(
    ['SELECT * FROM T WHERE x = ', ', y = ', ', z = ', ''],
                                  x         y         z
)(callback);
```

`connection.query` gets called with the parts of the static
template string specified by the author, followed by the results of
the expressions.  The final `(callback)` dispatches the query.

We can tweak SQL APIs so that, when used as template literal tags,
they escape the dynamic parts to preserve the intent of the author of
the static parts, and then re-interleave them to produce the query.

The example ([code][sql-code]) accompanying this chapter implements
this idea by defining a `mysql.sql` function that parses the static
parts to choose appropriate escapers for the dynamic parts.
We have put together a [draft PR][mysql-PR] to integrate this into
the *mysql* module.

It also provides string wrappers, `Identifier` and `SqlFragment`, to
make it easy to compose complex queries from simpler parts:

```js
// Compose a query from two fragments.
// When the value inside ${...} is a SqlFragment, no extra escaping happens.
connection.query`
    SELECT ${outputColumnsAndJoins(a, b, c)}
    WHERE  ${rowFilter(x, y, z)}
`(callback)

// Returns a SqlFragment
function rowFilter(x, y, z) {
  if (complexCondition) {
    // mysql.sql returns a SqlFragment
    return mysql.sql`X = ${x}`;
  } else {
    return mysql.sql`Y = ${y} AND Z=${z}`;
  }
}

function outputColumnsAndJoins(a, b, c) {
  return mysql.sql`...`;
}
```

----

Our goal was to make the easiest way to express an idea a secure way.

As seen below, this template tag API is the shortest way to express
this idea as shown below.  It is also tolerant to small variations
&mdash; the author may leave out quotes since the tag implementation
knows whether a substitution is inside quotes.

Shorter & tolerant != easier, but we hope that being shorter, more
robust, more secure, and easy to compose will make it a good migration
target for teams that realize they have a problem with SQL injection.
We also hope these factors will cause developers who have been through
such a migration to continue to use it in subsequent projects where it
may spread to other developers.


```js
// Proposed: Secure, tolerant, composes well.
connection.query`SELECT * FROM T WHERE x=${x}`(callback)
connection.query`SELECT * FROM T WHERE x="${x}"`(callback)

// String concatenation.  Insecure, composes well.
connection.query('SELECT * FROM T WHERE x = "' + x + '"', callback)
connection.query(`SELECT * FROM T WHERE x = "${x}"`, callback)

// String concatenation is not tolerant.
// Broken in a way that will be caught during casual testing.
connection.query('SELECT * FROM T WHERE x = ' + x, callback)
connection.query(`SELECT * FROM T WHERE x = ${x}`, callback)

// Prepared Statements.  Secure, composes badly, positional parameters.
connection.query('SELECT * FROM T WHERE x = ?', x, callback)
connection.query('SELECT * FROM T WHERE x = "?"', x, callback)  // Subtly broken
```



[`mysql`]: https://www.npmjs.com/package/mysql
[QUI]: ../chapter-1/threat-QUI.md
[prepared statements]: https://www.owasp.org/index.php/SQL_Injection_Prevention_Cheat_Sheet#Defense_Option_1:_Prepared_Statements_.28with_Parameterized_Queries.29
[tagged template literal]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_template_literals
[sql-code]: https://github.com/google/node-sec-roadmap/tree/master/chapter-7/examples/sql
[mysql-PR]: https://github.com/mysqljs/mysql/pull/1926
