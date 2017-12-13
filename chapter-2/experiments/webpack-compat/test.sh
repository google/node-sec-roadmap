echo <<LICENSE
// Copyright 2017 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
LICENSE

echo <<POLYGLOT
/*

This file is both a syntactically valid JS file and a bash file
so that we can test webpack in its minimal configuration.
In its minimal configuration, webpack tries to bundle this file.

You may run this file via

$ bash test.sh

The rest of this is visible to a shell interpreter but not when
webpack mysteriously decides to load this as a JavaScript file.
POLYGLOT

set -e

pushd "$(dirname "$0")"

echo Bundling
rm -f dist/bundle.js
./node_modules/.bin/webpack

echo
echo Running bundle
if node dist/bundle.js 2>&1 | grep -q 'Hello, World!'; then
    echo 'Ran ok'
else
    echo 'Failed to bundle dependency'
fi

echo
echo Looking for non production code
if grep -Hn 'NOT PRODUCTION CODE' dist/bundle.js; then
    echo 'Webpack bundled test code in its minimal configuration'
    false
fi

# */
