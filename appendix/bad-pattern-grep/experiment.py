#!/usr/bin/python

# Copyright 2017 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Look for problematic patterns like calls to eval and assignments
to innerHTML that often lead to XSS when not consistently guarded.
"""

import py_common.npm
import re
import sys

_LEFT_BOUNDARY = r'(?<![.$_\w])'
_RIGHT_BOUNDARY = r'(?![.$_\w])'

_PATTERNS = (
    ('eval',
     re.compile(_LEFT_BOUNDARY + r'eval' + _RIGHT_BOUNDARY)),
    ('Function constructor',
     re.compile(_LEFT_BOUNDARY + 'new\s*Function' + _RIGHT_BOUNDARY)),
    ('innerHTML assignment',
     re.compile('[.]\s*(inner|outer)HTML\s*=')),
    ('URL property assignment',
     re.compile('[.]\s*(src|href)\s*=')),
)

def find_violations(node_modules, module_name):
    violations = []
    js_srcs = py_common.npm.js_srcs_almost_worst_case(node_modules, module_name)
    for (_, js_path) in js_srcs:
        content = py_common.npm.preprocess_js_content(file(js_path, 'r').read())
        for (rule_name, pattern) in _PATTERNS:
            for _ in pattern.finditer(content):
                violations.append(rule_name)
    return violations


if __name__ == '__main__':
    (node_modules, separate_modules, top100_txt) = sys.argv[1:]

    top100 = [x for x in file(top100_txt).read().split('\n') if x]

    # Maps rule identifiers to sets of offending modules.
    rule_violations = {}

    module_count = 0
    for module_name in top100:
        violations = find_violations(node_modules, module_name)
        if 'Parse error' in violations or 'Argument list too long' in violations:
            pass
        else:
            module_count += 1
        for v in violations:
            if v in rule_violations:
                vmap = rule_violations[v]
            else:
                vmap = rule_violations[v] = {}
            vmap[module_name] = vmap.get(module_name, 0) + 1

    # TODO: exclude Parse error and Argument list too long

    print "## Grepping for Problems {#grep-problems}"
    print ""
    print "JS Conformance uses sophisticated type reasoning to find"
    print "problems in JavaScript code"
    print "(see [JS Conformance experiment](#jsconf))."
    print "It may not find problems in code that lacks type hints"
    print "or that does not parse."
    print ""
    print "Grep can be used to reliably find some subset of problems that"
    print "JS Conformance can identify."
    print ""
    print "If grep finds more of the kinds of problems that it can find"
    print "than JS Conformance, then the code cannot be effectively vetted"
    print "by code quality tools like JS Conformance."
    print ""
    print "| Violation | Count of Modules | Total Count | Quartiles |"
    print "| --------- | ---------------- | ----------- | --------- |"
    for (v, vmap) in sorted(rule_violations.items()):
        count = 0
        total_count = 0
        values = vmap.values()
        for n in values:
            count += 1
            total_count += n
        values += [0] * (module_count - count)
        values.sort()
        quartiles = '%d / %d / %d' % (
            values[len(values) >> 2],
            values[len(values) >> 1],
            values[(len(values) * 3) >> 2],
        )
        print "| `%s` | %d | %d | %s |" % (
            v, count, total_count, quartiles)
