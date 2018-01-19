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

const mysql = require('mysql')

// A simple lexer for SQL.
// SQL has many divergent dialects with subtly different
// conventions for string escaping and comments.
// This just attempts to roughly tokenize MySQL's specific variant.
// See also
// https://www.w3.org/2005/05/22-SPARQL-MySQL/sql_yacc
// https://github.com/twitter/mysql/blob/master/sql/sql_lex.cc
// https://dev.mysql.com/doc/refman/5.7/en/string-literals.html

// "--" followed by whitespace starts a line comment
// "#"
// "/*" starts an inline comment ended at first "*/"
// \N means null
// Prefixed strings x'...' is a hex string,  b'...' is a binary string, ....
// '...', "..." are strings.  `...` escapes identifiers.
// doubled delimiters and backslash both escape
// doubled delimiters work in `...` identifiers

const _PREFIX_BEFORE_DELIMITER = new RegExp(
  '^(?:' +
    (  // Comment
        '--(?=[\\t\\r\\n ])[^\\r\\n]*' +
        '|#[^\\r\\n]*' +
        '|/[*][\\s\\S]*?[*]/'
    ) +
    '|' + (
      // Run of non-comment non-string starts
      '(?:[^\'"`\\-/#]|-(?!-)|/(?![*]))'
    ) +
    ')*')
const _DELIMITED_BODIES = {
  '\'': /^(?:[^'\\]|\\[\s\S]|'')*/,
  '"': /^(?:[^"\\]|\\[\s\S]|"")*/,
  '`': /^(?:[^`\\]|\\[\s\S]|``)*/
}

/**
 * Returns a function that can be fed chunks of input and which
 * returns a delimiter context.
 */
function makeLexer () {
  let error = null
  let delimiter = null
  return (text) => {
    if (error) {
      throw error
    }
    text = String(text)
    while (text) {
      let pattern = delimiter
          ? _DELIMITED_BODIES[delimiter]
          : _PREFIX_BEFORE_DELIMITER
      let match = pattern.exec(text)
      if (!match) {
        throw (error = new Error(
          'Failed to lex starting at ' + JSON.stringify(text)))
      }
      let nConsumed = match[0].length
      if (text.length > nConsumed) {
        let c = text.charAt(nConsumed)
        if (delimiter) {
          if (c === delimiter) {
            delimiter = null
            ++nConsumed
          } else {
            throw (error = new Error(
              'Expected \\' + c + ' at ' + JSON.stringify(text)))
          }
        } else {
          if (Object.hasOwnProperty.call(_DELIMITED_BODIES, c)) {
            delimiter = c
            ++nConsumed
          } else {
            throw (error = new Error(
              'Expected delimiter at ' + JSON.stringify(text)))
          }
        }
      }
      text = text.substring(nConsumed)
    }
    return delimiter
  }
}

/** A string wrapper that marks its content as a SQL identifier. */
function Identifier (s) {
  const content = String(s)
  if (!content) {
    throw new Error('blank content')
  }
  if (!(this instanceof Identifier) ||
      Object.hasOwnProperty.call(this, 'content')) {
    return new Identifier(content)
  }
  this.content = content
}
Identifier.prototype.toString = function () {
  return String(this.content)
}

/**
 * A string wrapper that marks its content as a series of
 * well-formed SQL tokens.
 */
function SqlFragment (s) {
  const content = String(s)
  if (!content) {
    throw new Error('blank content')
  }
  if (!(this instanceof SqlFragment) ||
      Object.hasOwnProperty.call(this, 'content')) {
    return new SqlFragment(content)
  }
  this.content = content
}
SqlFragment.prototype.toString = function () {
  return String(this.content)
}

/** Avoid lexing every time we reuse the same hoisted strings object. */
const memoTable = new WeakMap()

/**
 * Template tag function that contextually autoescapes values
 * producing a SqlFragment.
 */
function sql (strings, ...values) {
  let raw = strings.raw

  // A buffer to accumulate the result.
  let result = ''

  // Used to find contexts.
  let lexer

  // We use a function that replays already parsed contexts where
  // possible.  If we can't, we collect the contexts on the delimiters
  // array so we can put them in the memoTable at the end.
  let delimiters = null
  if (Object.isFrozen(strings) && Object.isFrozen(raw)) {
    let e = memoTable.get(strings)
    if (e) {
      lexer = e()
    } else {
      delimiters = []
    }
  }
  if (!lexer) { lexer = makeLexer() }

  let delimiter = null
  let needsSpace = false
  for (let i = 0, n = raw.length; i < n; ++i) {
    if (i !== 0) {
      // The count of values must be 1 less than the surrounding
      // chunks of literal text.
      let value = values[i - 1]
      if (delimiter) {
        let valueStr
        if (delimiter === '`') {
          valueStr = mysql.escapeId(String(value))
            .replace(/^`|`$/g, '')
        } else {
          valueStr = mysql.escape(String(value))
          valueStr = valueStr.substring(1, valueStr.length - 1)
        }
        result += valueStr
      } else {
        let values = Array.isArray(value) ? value : [value]
        for (let j = 0, nValues = values.length; j < nValues; ++j) {
          if (j) {
            result += ', '
          }

          let one = values[j]
          let valueStr
          if (one instanceof SqlFragment) {
            if (!/(?:^|[\n\r\t ,(])$/.test(result)) {
              result += ' '
            }
            valueStr = one.toString()
            needsSpace = j + 1 === nValues
          } else {
            if (one instanceof Identifier) {
              valueStr = mysql.escapeId(one.toString())
            } else {
              // TODO: nested arrays?
              valueStr = mysql.format('?', one)
            }
          }
          result += valueStr
        }
      }
    }
    let chunk = String(raw[i])
    if (delimiter === '`') {
      // Treat raw \` in an identifier literal as an ending delimiter.
      chunk = chunk.replace(/^([^\\`]|\\[\s\S])*\\`/, '$1`')
    }
    let newDelimiter = lexer(chunk)
    if (newDelimiter === '`' && !delimiter) {
      // Treat literal \` outside a string context as starting an
      // identifier literal
      chunk = chunk.replace(
          /((?:^|[^\\])(?:\\\\)*)\\(`(?:[^`\\]|\\[\s\S])*)$/, '$1$2')
    }

    if (needsSpace) {
      if (chunk.length && !/^[\n\r\t ,)]/.test(chunk)) {
        result += ' '
      }
      needsSpace = false
    }

    result += chunk
    delimiter = newDelimiter
    if (delimiters) {
      delimiters.push(newDelimiter)
    }
  }

  if (delimiter) {
    throw new Error('Unclosed quoted string: ' + delimiter)
  }

  if (delimiters) {
    memoTable.set(
      strings,
      () => {
        let i = 0
        return (_) => delimiters[i++]
      })
  }
  return new SqlFragment(result)
}

exports.Identifier = Identifier
exports.SqlFragment = SqlFragment
exports.sql = sql

if (global.it) {
  // Expose for testing.
  // Harmless if this leaks
  exports.makeLexer = makeLexer
}
