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

"""Collates how many projects use install scripts.

Per https://docs.npmjs.com/misc/scripts we look for the
following keys under "scripts" in package.json:

  * preinstall
  * install
  * postinstall
"""

import json
import os.path
import py_common.npm
import sys

def uses_scripts(package_root):
    package_json = json.loads(
        file(os.path.join(package_root, 'package.json')).read())
    scripts_obj = package_json.get('scripts', None)
    if scripts_obj is None:
        return False
    for script_type in ('preinstall', 'install', 'postinstall'):
        # TODO: True if empty value
        if script_type in scripts_obj: return True
    return False

if __name__ == '__main__':
    (node_modules, separate_modules, top100_txt) = sys.argv[1:]

    per_package = py_common.npm.for_each_npm_package(
        node_modules, uses_scripts)
    total_count = 0
    uses_scripts = 0
    for uses in per_package.itervalues():
        if uses:
            uses_scripts += 1
        total_count += 1
    print (
"""
## Uses Scripts {#uses_scripts}

Unless steps are taken, installation scripts run code on
a developer's workstation when they have write access to
local repositories.  If this number is small, having
humans check installation scripts before running might
be feasible.

%d of %d = %1.02f%% use installation scripts
""" % (uses_scripts, total_count, (100.0 * uses_scripts) / total_count))
