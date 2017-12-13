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

"""Looks for test code patterns under node_modules.

Patterns identify include

  * require('assert')
  * require('chai')
  * require('chai/*')
  * require('mocha')
  * require('should')
  * require('unexpected')

"""

import json
import os.path
import py_common.npm
import re
import shutil
import sys


test_code_pattern = re.compile(
    r'(?m)(?:^|[^.\w])require\s*[(]\s*[\'\"](?:assert|chai|chai/[^\'\"]|mocha|should|unexpected)[\'\"]')


if __name__ == '__main__':
    (node_modules, separate_modules, top100_txt) = sys.argv[1:]

    top100 = [x for x in file(top100_txt).read().split('\n') if x]

    uses = 0
    total_count = 0
    has_test_code = {}
    for module_name in top100:
        module_root = os.path.join(separate_modules, module_name)
        for js_file in py_common.npm.js_files_under(module_root):
            js_content = file(js_file, 'r').read()
            if test_code_pattern.search(js_content):
                uses += 1
                break
        total_count += 1

    print (
"""
## Prod bundle includes test code {#test_code}

Some of the top 100 modules are test code, e.g. mocha, chai.
This measures which modules, when installed `--only=prod` include
test patterns.

%d of %d = %1.02f%% contain test code patterns
""" % (uses, total_count, (100.0 * uses) / total_count))
