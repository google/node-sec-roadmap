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

"""Looks for lazy loading patterns.

Patterns to identify include

  * { ... require(...)

"""

import json
import os.path
import py_common.npm
import re
import shutil
import sys


lazy_load_pattern = re.compile(
    r'[{][^}]*(?<![_$\w.])require\s*\(')

def find_lazy_load(node_modules, module_name):
    return py_common.npm.js_srcs_matching(
        node_modules, module_name, lazy_load_pattern,
        module_filter=py_common.npm.ignore_tools_that_can_run_early(module_name))


if __name__ == '__main__':
    (node_modules, separate_modules, top100_txt) = sys.argv[1:]

    top100 = [x for x in file(top100_txt).read().split('\n') if x]

    uses = 0
    total_count = 0
    has_lazy_load = {}
    for module_name in top100:
        js_srcs = find_lazy_load(node_modules, module_name)
        has_lazy_load[module_name] = js_srcs
        if len(js_srcs):
            uses += 1
        total_count += 1

    print (
"""
## Lazy loads {#lazy_load}

Lazy loading can complicate code bundling if care is not taken.

%d of %d = %1.02f%% contain a use of require inside a `{...}` block.
""" % (uses, total_count, (100.0 * uses) / total_count))
