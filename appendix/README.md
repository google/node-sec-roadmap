# npm Experiments

Below are summaries of experiments to check how compatible common npm
modules are with preprocessing, static checks, and other measures
to manage cross-cutting security concerns.


<!-- Begin generated summary -->

## Grepping for Problems {#grep-problems}

JS Conformance uses sophisticated type reasoning to find
problems in JavaScript code
(see [JS Conformance experiment](#jsconf)).
It may not find problems in code that lacks type hints
or that does not parse.

Grep can be used to reliably find some subset of problems that
JS Conformance can identify.

If grep finds more of the kinds of problems that it can find
than JS Conformance, then the code cannot be effectively vetted
by code quality tools like JS Conformance.

| Violation | Count of Modules | Total Count | Quartiles |
| --------- | ---------------- | ----------- | --------- |
| `Function constructor` | 32 | 200 | 0 / 0 / 1 |
| `URL property assignment` | 35 | 471 | 0 / 0 / 3 |
| `eval` | 24 | 87 | 0 / 0 / 0 |
| `innerHTML assignment` | 17 | 81 | 0 / 0 / 0 |

## Dynamic loads {#dynamic_load}

Dynamic loading can complicate code bundling.

33 of 108 = 30.56% call `require(...)` without a literal string argument.

## JS Conformance {#jsconf}

JS Conformance identifies uses of risky APIs.

Some modules did not parse.  This may be dues to typescript.
JSCompiler doesn't deal well with mixed JavaScript and TypeScript
inputs.

If a module is both in the top 100 and is a dependency of another
module in the top 100, then it will be multiply counted.

Out of 69 modules that parsed

| Violation | Count of Modules | Total Count | Quartiles |
| --------- | ---------------- | ----------- | --------- |
| `"arguments.callee" cannot be used in strict mode` | 2 | 3 | 0 / 0 / 0 |
| `Argument list too long` | 8 | 8 | 0 / 0 / 0 |
| `Illegal redeclared variable: ` | 2 | 9 | 0 / 0 / 0 |
| `Parse error.` | 31 | 232 | 0 / 0 / 2 |
| `This style of octal literal is not supported in strict mode.` | 4 | 11 | 0 / 0 / 0 |
| `Violation: Assigning a value to a dangerous property via setAttribute is forbidden` | 1 | 4 | 0 / 0 / 0 |
| `Violation: Function, setTimeout, setInterval and requestAnimationFrame are not allowed with string argument. See ...` | 9 | 91 | 0 / 0 / 0 |
| `Violation: eval is not allowed` | 1 | 3 | 0 / 0 / 0 |
| `required "..." namespace not provided yet` | 7 | 30 | 0 / 0 / 0 |
| `type syntax is only supported in ES6 typed mode: ` | 3 | 132 | 0 / 0 / 0 |

## Lazy loads {#lazy_load}

Lazy loading can complicate code bundling if care is not taken.

71 of 108 = 65.74% contain a use of require inside a `{...}` block.


## Prod bundle includes test code {#test_code}

Some of the top 100 modules are test code, e.g. mocha, chai.
This measures which modules, when installed `--only=prod` include
test patterns.

50 of 108 = 46.30% contain test code patterns


## Uses Scripts {#uses_scripts}

Unless steps are taken, installation scripts run code on
a developer's workstation when they have write access to
local repositories.  If this number is small, having
humans check installation scripts before running might
be feasible.

4 of 979 = 0.41% use installation scripts


<!-- End generated summary -->



## Methodology

The code is [available on Github][code].

```bash
$ npm --version
3.10.10
```

### Top 100 Module list

I extracted `top100.txt` by browsing to the most depended-upon
[package list][top100] and running the below in the dev console until
I had >= 100 entries.

```js
var links = document.querySelectorAll('a.name')
var top100 = Object.create(null)
for (var i = 0; i < links.length; ++i) {
  var link = links[i];
  var packageName = link.getAttribute('href').replace(/^.*\/package\//, '')
  top100[packageName] = true;
}
var top100Names = Object.keys(top100)
top100Names.sort();
top100Names
```

----

We also require some tools so that we can run JSCompiler against
node modules.  From the root directory:

```sh
mkdir tools
curl https://dl.google.com/closure-compiler/compiler-latest.zip \
     > /tmp/closure-latest.zip
pushd tools
  jar xf /tmp/closure-latest.zip
popd
pushd jsconf
  mkdir externs
  pushd externs
    git clone https://github.com/dcodeIO/node.js-closure-compiler-externs.git
  popd
popd
```


### Experiments

Each experiment corresponds to a directory with an executable
`experiment.py` file which takes a `node_modules` directory and the top 100
module list and which outputs a snippet of markup.

Running

```bash
cat top100.txt | xargs npm install --ignore-scripts --only=prod
mkdir separate-modules
cd separate-modules
for pn in $(cat ../top100.txt ); do
  mkdir -p "$pn"
  pushd "$pn"
  npm install -g --prefix="node_modules/$pn" --ignore-scripts --only=prod "$pn"
  popd
done
```

pulls down the list of node modules.  As of this writing, there are 980
modules that are in the top100 list or are direct or indirect prod
dependencies thereof.

To run the experiments and place the outputs under `/tmp/mds/`, run

```bash
mkdir -p /tmp/mds/
export PYTHONPATH="$PWD:$PWD/../third_party:$PYTHONPATH"
for f in *; do
  if [ -f "$f"/experiment.py ]; then
    "$f"/experiment.py node_modules separate-modules top100.txt \
    > "/tmp/mds/$f.md"
  fi
done
```

Concatenating those markdown snippets produces the summary above.

```bash
(for f in $(echo /tmp/mds/*.md | sort); do
   cat "$f";
 done) \
> /tmp/mds/summary
```

[code]: https://github.com/google/node-sec-roadmap/tree/master/appendix
[top100]: https://www.npmjs.com/browse/depended
