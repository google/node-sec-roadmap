#!/bin/bash

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

set -e

cd "$(dirname "$0")"

mkdir -p graphs
(
    echo 'digraph Modules {'

    # Run the tests and filter the logs for log entries from our
    # hacked Module._load.
    # Also relativize source file paths.
    NODE=/Users/msamuel/work/node/out/Release/node \
    PATH="/Users/msamuel/work/node/out/Release/:$PATH" \
    ./node_modules/.bin/mocha 2>&1 \
    | perl -ne 's/"$ENV{PWD}/"./g; if (s/^REQUIRE_LOG_DOT://) { print $_; } else { print STDERR $_; }'

    # Add an edge from package.json to the main module.
    echo '    "./package.json" -> "./index.js";'
    echo '    "./package.json" [fillcolor=black,fontcolor=white,style=filled];'
    echo '}'
) > graphs/full.dot

python -c '
import re
import sys

EDGE_RE = re.compile(r"""^ *(\"(?:[^\"\\]|\\.)*\") -> (\"(?:[^\"\\]|\\.)*\");$""")
GRAPH_END_RE = re.compile(r"^ *\}")

edges = {}
def add_edge(src, tgt):
  tgts = edges.get(src)
  if tgts is None:
    tgts = []
    edges[src] = tgts
  tgts.append(tgt)

for line in sys.stdin:
  edges_match = EDGE_RE.match(line)
  if edges_match is not None:
    add_edge(edges_match.group(1), edges_match.group(2))
    continue
  elif GRAPH_END_RE.match(line):
    reachable = set()
    def find_reachable(src):
      if src not in reachable:
        reachable.add(src)
        for tgt in edges.get(src, ()):
          find_reachable(tgt)
    find_reachable("\"./package.json\"")
    reachable = list(reachable)
    reachable.sort()
    for src in reachable:
      for tgt in edges.get(src, ()):
        print "    %s -> %s;" % (src, tgt)
  print line,
' < graphs/full.dot > graphs/filtered.dot

for graph in full filtered; do
    dot -Tsvg graphs/"$graph".dot > graphs/"$graph".svg
done

# Start walking from package.json

