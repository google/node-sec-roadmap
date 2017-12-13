/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// test/test.js

var expect = require("chai").expect;
var index = require("../index");

function tokens(...chunks) {
    let lexer = index.makeLexer();
    let out = [];
    for (let i = 0, n = chunks.length; i < n; ++i) {
        out.push(lexer(chunks[i]) || '_');
    }
    return out.join(',');
}

describe('sql template tags', () => {
    describe('lexer', () => {
        it('empty string', () => {
            expect('_').to.equal(tokens(''));
        });
        it('hash comments', () => {
            expect('_,_').to.equal(tokens(' # "foo\n', ''));
        });
        it('dash comments', () => {
            expect('_,_').to.equal(tokens(' -- \'foo\n', ''));
        });
        it('block comments', () => {
            expect('_,_').to.equal(tokens(' /* `foo */', ''));
        });
        it('dq', () => {
            expect('_').to.equal(tokens('SELECT "foo"'));
            expect('_').to.equal(tokens('SELECT `foo`, "foo"'));
            expect('",_').to.equal(tokens('SELECT "', '"'));
            expect('",_').to.equal(tokens('SELECT "x', '"'));
            expect('",_').to.equal(tokens('SELECT "\'', '"'));
            expect('",_').to.equal(tokens('SELECT "`', '"'));
            expect('",_').to.equal(tokens('SELECT """', '"'));
            expect('",_').to.equal(tokens('SELECT "\\"', '"'));
        });
        it('sq', () => {
            expect('_').to.equal(tokens('SELECT \'foo\''));
            expect('_').to.equal(tokens('SELECT `foo`, \'foo\''));
            expect('\',_').to.equal(tokens('SELECT \'', '\''));
            expect('\',_').to.equal(tokens('SELECT \'x', '\''));
            expect('\',_').to.equal(tokens('SELECT \'"', '\''));
            expect('\',_').to.equal(tokens('SELECT \'`', '\''));
            expect('\',_').to.equal(tokens('SELECT \'\'\'', '\''));
            expect('\',_').to.equal(tokens('SELECT \'\\\'', '\''));
        });
        it('bq', () => {
            expect('_').to.equal(tokens('SELECT `foo`'));
            expect('_').to.equal(tokens('SELECT "foo", `foo`'));
            expect('`,_').to.equal(tokens('SELECT `', '`'));
            expect('`,_').to.equal(tokens('SELECT `x', '`'));
            expect('`,_').to.equal(tokens('SELECT `\'', '`'));
            expect('`,_').to.equal(tokens('SELECT `\"', '`'));
            expect('`,_').to.equal(tokens('SELECT ```', '`'));
            expect('`,_').to.equal(tokens('SELECT `\\`', '`'));
        });
    });

    function runTagTest(golden, test) {
        // Run multiply to test memoization bugs.
        for (let i = 3; --i >= 0;) {
            let result = test();
            if (result instanceof index.SqlFragment) {
                result = result.toString();
            } else {
                throw new Error('Expected SqlFragment not ' + result);
            }
            expect(golden).to.equal(result);
        }
    }

    describe('sql', () => {
        it('numbers', () => {
            runTagTest(
              'SELECT 2',
              () => index.sql`SELECT ${1 + 1}`);
        });
        it('date', () => {
            runTagTest(
              `SELECT '2000-01-01 00:00:00.000'`,
              () => index.sql`SELECT ${new Date(Date.UTC(2000, 0, 1, 0, 0, 0))}`);
        });
        it('string', () => {
            runTagTest(
              `SELECT 'Hello, World!\\n'`,
              () => index.sql`SELECT ${"Hello, World!\n"}`);
        });
        it('identifier', () => {
            runTagTest(
              'SELECT `foo`',
              () => index.sql`SELECT ${new index.Identifier('foo')}`);
        });
        it('fragment', () => {
            let fragment = new index.SqlFragment('1 + 1');
            runTagTest(
              `SELECT 1 + 1`,
              () => index.sql`SELECT ${fragment}`);
        });
        it('fragment no token merging', () => {
            let fragment = new index.SqlFragment('1 + 1');
            runTagTest(
              `SELECT 1 + 1 FROM T`,
              () => index.sql`SELECT${fragment}FROM T`);
        });
        it('string in dq string', () => {
            runTagTest(
              `SELECT "Hello, World!\\n"`,
              () => index.sql`SELECT "Hello, ${"World!"}\n"`);
        });
        it('string in sq string', () => {
            runTagTest(
              `SELECT 'Hello, World!\\n'`,
              () => index.sql`SELECT 'Hello, ${"World!"}\n'`);
        });
        it('string after string in string', () => {
            // The following tests check obliquely that '?' is not
            // interpreted as a prepared statement meta-character
            // internally.
            runTagTest(
              `SELECT 'Hello', "World?"`,
              () => index.sql`SELECT '${"Hello"}', "World?"`);
        });
        it('string before string in string', () => {
            runTagTest(
              `SELECT 'Hello?', 'World?'`,
              () => index.sql`SELECT 'Hello?', '${"World?"}'`);
        });
        it('number after string in string', () => {
            runTagTest(
              `SELECT 'Hello?', 123`,
              () => index.sql`SELECT '${"Hello?"}', ${123}`);
        });
        it('number before string in string', () => {
            runTagTest(
              `SELECT 123, 'World?'`,
              () => index.sql`SELECT ${123}, '${"World?"}'`);
        });
        it('string in identifier', () => {
            runTagTest(
              'SELECT `foo`',
              () => index.sql`SELECT \`${"foo"}\``);
        });
        it('number in identifier', () => {
            runTagTest(
              'SELECT `foo_123`',
              () => index.sql`SELECT \`foo_${123}\``);
        });
        it('array', () => {
            let id = new index.Identifier('foo');
            let frag = new index.SqlFragment('1 + 1');
            let values = [123, 'foo', id, frag];
            runTagTest(
              "SELECT X FROM T WHERE X IN (123, 'foo', `foo`, 1 + 1)",
              () =>
                index.sql`SELECT X FROM T WHERE X IN (${values})`);
        });
    });

});
