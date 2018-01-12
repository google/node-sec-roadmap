# Query Injection

[Query injection][] occurs when an attacker causes a query sent to a
database or other backend to have a [structure][spp] that differs from
that the developer intended.

```js
connection.query(
    'SELECT * FROM Table WHERE key="' + value + '"',
    callback);
```

If an attacker controls `value` and can cause it to contain a single
quote, then they can cause execution of a query with a different structure.
For example, if they can cause

```js
value = ' " OR 1 -- two dashes start a line comment';
```

then the query sent is `SELECT * FROM Table WHERE key=" " OR 1 -- ...`
which returns more rows than intended possibly [leaking](./threat-EXF.md)
data that the requester should not have been able to access, and may
cause other code that loops over the result set to modify rows other than
the ones the system's authors intended.

Some backends allow statement chaining so compromising a statement
that seems to only read data:

```js
value = '"; INSERT INTO Table ...  --'
```

can violate system integrity by forging records:

```js
' SELECT * FROM Table WHERE key="' + value + '" ' ===
' SELECT * FROM Table WHERE key=""; INSERT INTO Table ... --" '
```

or deny service via mass deletes.

Query injection has a [long and storied history][hall-of-shame].

[Query injection]: http://bobby-tables.com/
[hall-of-shame]: http://codecurmudgeon.com/wp/sql-injection-hall-of-shame/
[spp]: https://rawgit.com/mikesamuel/sanitized-jquery-templates/trunk/safetemplate.html#structure_preservation_property
