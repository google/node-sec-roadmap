#!/usr/bin/python

"""
Runs JSConformance on each of the top 100 modules and collates the results.
"""

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

import json
import os.path
import py_common.npm
import re
import shutil
import subprocess
import sys


_error_re = re.compile(r'(?m)^\S+: ERROR - ((?![.]\s)[^\r\n]*)')
# Patterns that can be used to group error messages by glossing over
# any content not in a capturing group.
_simplifier_res = (
    re.compile(r'^(required ").*?(" namespace not provided yet)'),
    re.compile(r'^(type syntax is only supported in ES6 typed mode: ).*'),
    re.compile(r'^(Illegal redeclared variable: ).*'),
    re.compile(r'^(Parse error[.]).*'),
)


def run_jsconf(node_modules, module_name, externs):
    """
    Runs JSConformance on the given module's source files.
    """
    srcs = py_common.npm.js_srcs_almost_worst_case(
        node_modules, module_name,
        module_filter=py_common.npm.ignore_tools_that_can_run_early(module_name))
    if not srcs:
        raise Exception(module_name + ' has no srcs')
    args = [
        'java',
        '-jar',
        os.path.join(
            os.path.dirname(node_modules),
            'tools',
            'closure-compiler-latest',
            'closure-compiler.jar'),
        '--process_common_js_modules',
        '--checks-only',
        '--third_party=true',
        '--module_resolution=NODE',
        '--js_module_root=%s' % os.path.realpath(node_modules),
        '--jscomp_error=conformanceViolations',
        '--conformance_configs',
        os.path.join(
            os.path.dirname(node_modules),
            'jsconf',
            'conformance_proto.textproto'),
    ]
    for (_, js_file) in srcs:
        args += ['--js', os.path.realpath(js_file)]
    for js_file in sorted(externs):
        args += ['--externs', js_file]
    #print >>sys.stderr, len(' '.join(args))
    if len(' '.join(args)) >= 240000:  # `getconf ARG_MAX` for Mac OSX
        return ['Argument list too long']
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    content = process.stdout.read()
    retcode = process.wait()
    violations = []
    if retcode == 0:
        violations.append('Passed')
    for match in _error_re.finditer(content):
        violation = match.group(1)
        for simpler in _simplifier_res:
            match = simpler.match(violation)
            if match:
                violation = '...'.join(match.groups())
        violations.append(violation)
    return violations

if __name__ == '__main__':
    (node_modules, separate_modules, top100_txt) = sys.argv[1:]

    top100 = [x for x in file(top100_txt).read().split('\n') if x]

    externs = set()
    for externs_file in py_common.npm.js_files_under(
            os.path.join(os.path.dirname(sys.argv[0]), 'externs')):
        if os.path.basename(os.path.dirname(externs_file)) == 'tests':
            continue
        externs.add(externs_file)

    # Maps rule identifiers to sets of offending modules.
    rule_violations = {}


    module_count = 0
    for module_name in top100:
        violations = run_jsconf(node_modules, module_name, externs)
        if ('Parse error.' in violations
            or 'Argument list too long' in violations):
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

    print "## JS Conformance {#jsconf}"
    print ""
    print "JS Conformance identifies uses of risky APIs."
    print ""
    print "Some modules did not parse.  This may be dues to typescript."
    print "JSCompiler doesn't deal well with mixed JavaScript and TypeScript"
    print "inputs."
    print ""
    print "If a module is both in the top 100 and is a dependency of another"
    print "module in the top 100, then it will be multiply counted."
    print ""
    print "Out of %d modules that parsed" % module_count
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
