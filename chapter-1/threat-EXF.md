# Exfiltration of Data

Web applications and services may produce response bodies that
include too much information.  "Exfiltration" is when an attacker
can cause a response to leak data of their choosing in a response.

This can happen when server-side JavaScript has access to more
data than it needs to do its job and either

*  it serializes unintended information and no one notices or
*  an attacker controls what is serialized.

Consider

```js
Object.assign(output, this[str]);
```

If the attacker controls `str` then they may be able to pick any field
of `this` or possibly any global field.

This problem is not new to Node.js but we consider this higher
frequency for Node.js for these reasons:

*  There is no equivalent to `Object.assign` in most backend languages.
   It's possible in Python and Java via reflective operators but
   security auditors can narrow down code that might suffer this vulnerability
   to those that use reflection.
   `Object.assign`, `$.extend` and similar operators are widely used in
   idiomatic JavaScript.
*  In most backend languages, `obj[...]` does not allow aliasing of all
   properties.
   For example, Python allows `obj[...]` on types that implement `__getitem__`
   which is not the case for user-defined classes.
   Java allows has generic collections and maps, but for user-defined classes
   the equivalent code pattern requires reflection and possibly calls to
   `setAccessible(true)`.
   JavaScript makes it easier to alias properties and methods and common
   JavaScript idioms make it harder for security auditors to narrow down
   code that might inadvertently allow exfiltration.


`Object.assign` and related copy operators are also potential
[mass assignment][] vectors as in:

```js
Object.assign(systemData, JSON.parse(untrustedInput))
```

[mass assignment]: https://en.wikipedia.org/wiki/Mass_assignment_vulnerability
