"""
Utilities for mucking with NPM packages
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
import os
import os.path
import re
import subprocess
import sys
import tempfile

import jslex.jslex

def install_packages(*package):
    """
    Creates a temporary node_modules directory with the given packages
    and returns it.
    """
    tmp_dir = tempfile.mkdtemp()
    tmp_node_modules_dir = os.path.join(tmp_dir, 'node_modules')
    os.mkdir(tmp_node_modules_dir)
    subprocess.check_call([
        'npm', 'install', '--ignore-scripts', '--only=prod',
        '-g', '--prefix', tmp_node_modules_dir,
        '--'] + list(package))
    return tmp_node_modules_dir


def for_each_npm_package(node_modules_dir, f):
    """
    Calls f with each package directory path.

    Returns an object with the result of each call keyed by
    package name.

    For a dir tree like
       node_modules
         foo
           package.json
           ...
         bar
           package.json
           ...
         baz
           package.json
           ...
         .bin
           ...
    returns
        {
          'bar': f('node_modules/bar'),
          'baz': f('node_modules/baz'),
          'foo': f('node_modules/foo')
        }
    """
    result = {}
    for fname in os.listdir(node_modules_dir):
        if fname not in ('.', '..'):
            if os.path.isfile(os.path.join(node_modules_dir, fname, 'package.json')):
                result[fname] = f(os.path.join(node_modules_dir, fname))
    return result

def ignore_tools_that_can_run_early(module_name):
    """
    A module filter that filters out dependencies on modules that
    can be run during the bundling/validation process so are not strictly
    necessary at runtime.
    """
    return lambda mn: mn == module_name or not (
        mn.startswith('babel')
        or mn.startswith('eslint'))

_REQUIRE_RE = re.compile(r'(?<![\w.])require\s*[(]([^\)]*)')
_REL_REQUIRE_RE = re.compile(r'^[.][.]?/')

def js_srcs_almost_worst_case(node_modules, module_name, module_filter=None):
    """
    The set of JS & TS source files required by a module
    including those required by prod dependencies.

    This does not take into account TS imports.

    This is not entirely conservative.
    We make an optimistic assumption that a dynamic load,
    a require(x) where x is not a string literal, only
    loads files from the same module.
    This is not true, e.g. when bazel-core loads extension
    modules.
    These cross-module loads need not only load from prod
    dependencies, so assuming otherwise would not actually
    make us conservative either.

    Returns [('module', '/abs/path/to/src.js'), ...]
    """
    if module_filter is None:
        module_filter = lambda _: True
    js_files = set()
    unprocessed = [module_name]
    visited = set()
    while unprocessed:
        up_module_name = unprocessed.pop()
        if up_module_name in visited: continue
        visited.add(up_module_name)
        if not module_filter(up_module_name): continue
        rq = None
        try:
            rq = requires(node_modules, module_name)
        except:
            import traceback
            traceback.print_exc()
        if rq is not None and rq['upper']:
            js_files.update([(up_module_name, src) for src in rq['srcs']])
            unprocessed += rq['deps']
        else:
            #print >>sys.stderr, "Falling back to worst-case for %s required by %s" % (
            #    up_module_name, module_name)
            js_files.update([(up_module_name, src) for src in
                             js_files_under(
                                 os.path.join(node_modules, up_module_name))
                             if not probable_non_prod_file(src)])
            package_json = None
            try:
                package_json = json.loads(
                    file(os.path.join(node_modules, up_module_name, 'package.json'), 'r')
                    .read())
            except:
                print >>sys.stderr, "Undeclared dependency %s" % up_module_name
            if package_json is not None:
                unprocessed += package_json['dependencies'].keys()
    return tuple(sorted(js_files))

def requires(node_modules, module_name):
    """
    Follows require() calls to bound the set of JS files in a module.

    Returns {
      'srcs': [...],  # main.js and same-module files required thereof
      'deps': [...],  # required modules
      'upper': True,  # True when srcs and deps accounts for all require calls.
    }
    """
    module_root = os.path.join(node_modules, module_name)
    package_json = json.loads(
        file(os.path.join(module_root, 'package.json')).read())
    main_files = package_json.get('main', None)
    if type(main_files) in (str, unicode):
        main_files = (main_files,)
    if not main_files:
        return { 'srcs': (), 'deps': (), 'upper': False }
    srcs = set()
    deps = set()
    upper = True
    visited = set()
    unprocessed = [os.path.join(module_root, rp) for rp in main_files]
    while unprocessed:
        src = os.path.realpath(unprocessed.pop())
        if src in visited: continue
        visited.add(src)
        if os.path.isdir(src):
            for f in js_files_under(src):
                unprocessed.append(f)
        else:
            srcs.add(src)
            content = ''
            try:
                content = file(src, 'r').read()
            except:
                upper = False
            for match in _REQUIRE_RE.finditer(content):
                arg = match.group(1).strip()
                if not arg:
                    pass  # Zero arguments
                elif len(arg) > 2 and arg[0] in ('"', "'") and arg[0] == arg[-1]:
                    try:
                        arg = json.loads('"%s"' % arg[1:-1])
                    except:
                        #print >>sys.stderr, "Cannot parse require argument %s" % arg
                        upper = False
                    if _REL_REQUIRE_RE.match(arg):
                        if not arg.endswith('.js'): arg += '.js'
                        unprocessed.append(arg)
                    else:
                        deps.add(arg)
                else:
                    upper = False
    return {
        'srcs': tuple(sorted(srcs)),
        'deps': tuple(sorted(deps)),
        'upper': upper
    }

def js_files_under(root_dir):
    for dir_path, subdir_list, file_list in os.walk(root_dir):
        for f in file_list:
            if f.endswith('.js') or f.endswith('.ts'):
                yield os.path.join(dir_path, f)

def preprocess_js_content(content):
    """
    Preprocesses JS content to make it easier to operate on.

    All comments are replaced with spaces, and string literal
    content is upper-cased to make it easier to distinguish
    lower-case keywords and identifiers from similar content that
    appears inside a string literal.
    """

    lexer = jslex.jslex.JsLexer()
    canon_tokens = []
    for (tok_type, tok_content) in lexer.lex(content):
        if tok_type in ('comment', 'linecomment'):
            tok_content = ' '
        elif tok_type in ('regex', 'string'):
            tok_content = tok_content.upper()
        canon_tokens.append(tok_content)
    processed_content = ''.join(canon_tokens)

    return processed_content

def js_srcs_matching(node_modules, module_name, pattern, module_filter=None):
    """
    A list of srcs under root_dir whose content
    matches pattern.
    """

    srcs = js_srcs_almost_worst_case(
        node_modules=node_modules,
        module_name=module_name,
        module_filter=module_filter)

    matching_srcs = []
    for src in srcs:
        (_, path) = src
        canon_content = preprocess_js_content(file(path, 'r').read())
        match = pattern.search(canon_content)
        if match:
            matching_srcs.append(src)
    return matching_srcs

# by visual examination of
# `find node_modules/ -type d | perl -pe 's|/|\n|g' | sort | uniq`
_NON_PROD_PATH = re.compile(
    r'(?i)(?:^|[/\\])(?:tests?|testdata|testing|.github|__tests__|demo|examples?|benchmarks?)(?:$|[/\\])')
def probable_non_prod_file(path):
    """
    Skip probable non test files when falling back to directory scanning.
    """
    return _NON_PROD_PATH.search(path) is not None
