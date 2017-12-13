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

"""Looks for dynamic code loading patterns.

Patterns to identify include

  * require(...) where ... is not a string literal.
  * eval
  * Function(...) where there is more than one argument or the sole
    argument is not a function.

"""

import json
import os.path
import py_common.npm
import re
import shutil
import sys


dynamic_load_pattern = re.compile(
    r'(?<![_$\w.])require\s*\(\s*[^\s)\"\']'
#    r'(?<![_$\w.])require\s*(?:\(\s*[^\s)\"\']|[^\(])'  # To also match indirect uses of require, like aliasing it to a variable.
    )

def find_dynamic_load(node_modules, module_name):
    return py_common.npm.js_srcs_matching(
        node_modules, module_name, dynamic_load_pattern,
        module_filter=py_common.npm.ignore_tools_that_can_run_early(module_name))


if __name__ == '__main__':
    (node_modules, separate_modules, top100_txt) = sys.argv[1:]

    top100 = [x for x in file(top100_txt).read().split('\n') if x]

    uses = 0
    total_count = 0
    has_dynamic_load = {}
    for module_name in top100:
        js_srcs = find_dynamic_load(node_modules, module_name)
        has_dynamic_load[module_name] = js_srcs
        if len(js_srcs):
            uses += 1
        total_count += 1

#    for k, v in has_dynamic_load.iteritems():
#        print "%s: %r" % (k, v)

    print (
"""
## Dynamic loads {#dynamic_load}

Dynamic loading can complicate code bundling.

%d of %d = %1.02f%% call `require(...)` without a literal string argument.
""" % (uses, total_count, (100.0 * uses) / total_count))
