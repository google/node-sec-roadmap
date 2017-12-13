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

const crypto = require('crypto');

/** A regex chunk that matches s. */
function reEsc(s) {
    return s.replace(/[\^\[\]\-\\]/g, '\\$&').replace(/[*+(){}|$/.]/g, '[$&]');
}

/** The union of the given regex chunks. */
function reUnion(ls) {
    return '(?:' + ls.join('|') + ')';
}

const BRACKET_DELIMS = [];
const ALL_DELIMS = ['"', "'", '#', '`', '$((', '$(', '${', '(', '<<-', '<<'];
const NLS = ['\n', '\r\n', '\r'];

// Embedders take the value to embed and return the text to substitute. */
/** Embeds a value where a single quoted string token is allowed. */
function emsq(x) {
    if (x instanceof ShFragment) {
        return x.content;
    }
    return "'" + emisq(x) + "'";
}
/** Embeds a string in an opened single quoted string */
function emisq(x) {
    if (x == null) { return ''; }
    return String(x).replace(/'/g, `'"'"'`);
}
/** Embeds a string in an opened double quoted string */
function emidq(x) {
    if (x == null) { return ''; }
    return String(x).replace(/[$\"\\]/g, '\\$&');
}
/** Embeds in a comment, replacing the content with a space */
function emsp(x) {
    return buf + ' ';
}
/**
 * Embeds in heredoc.
 * We handle rewriting HEREDOC labels to avoid collisions later.
 */
function emhd(x) {
    return String(x);
}

/**
 * Maps start delimiters to their end delimiters and whether
 * '\\' and start delimiters are significant.
 *
 * Properties:
 * .ends: delimiters that end blocks that start with the key.
 * .embed: a function that converts values to content that embeds within
 *         the block.
 * .escapes: true iff backslash escapes a character that might otherwise
 *         participate in a start or end delimiter, or another backslash.
 * .nests: list of start delimiters that are significant in the block.
 *
 * Extra properties derived from above:
 * .bodyRegExp: matches a prefix of a string that is a chunk of body content.
 * .startRegExp: matches a start delimiter in nests at start of input
 * .endRegExp: matches an end delimiter at start of input.
 */
const DELIMS = {
    '':    { ends: [],     embed: emsq,  escapes: false, nests: ALL_DELIMS },
    '"':   { ends: ['"'],  embed: emidq, escapes: true,  nests: ['`', '$((', '$(', '${'] },
    "'":   { ends: ["'"],  embed: emisq, escapes: false, nests: [] },
    '`':   { ends: ['`'],  embed: emsq,  escapes: true,  nests: ALL_DELIMS },
    '$((': { ends: ['))'], embed: emsq,  escapes: true,  nests: ALL_DELIMS },
    '$(':  { ends: [')'],  embed: emsq,  escapes: true,  nests: ALL_DELIMS },
    '${':  { ends: ['}'],  embed: emsq,  escapes: true,  nests: ALL_DELIMS },
    '(':   { ends: [')'],  embed: emsq,  escapes: true,  nests: ALL_DELIMS },
    // '#' requires special handling below since it must follow whitespace
    '#':   { ends: NLS,    embed: emsp,  escapes: false, nests: [] },
    // Heredoc requires special handling below to handle the nonce.
    '<<':  { ends: NLS,    embed: emhd,  escapes: false, nests: [] },
    '<<-': { ends: NLS,    embed: emhd,  escapes: false, nests: [] },
};

// Flesh out the DELIMS table with derived information used by the lexer.
((() => {
    for (let startDelim in DELIMS) {
        const v = DELIMS[startDelim];

        let starts = v.nests.length ? reUnion(v.nests.map(reEsc)) : '(?!)';
        let ends = v.ends.length ? reUnion(v.ends.map(reEsc)) : '(?!)';
        let pattern  = '^(?:';  // Any number of (see Kleene-* below)
        if (v.escapes) {
            pattern += '[\\\\][\\s\\S]|'  // Any escaped character or ...
        }
        {
            pattern += '(?!' + ends;   // Not one of ends
            if (v.nests.length) {
                pattern += '|' + starts;
            }
            pattern += ')';
        }
        // Character to match.
        pattern += v.escapes ? '[^\\\\]' : '[\\s\\S]';
        pattern += ')*';

        v.bodyRegExp = new RegExp(pattern);
        v.endRegExp = new RegExp('^' + ends);
        v.startRegExp = new RegExp('^' + starts);
    }
})());

function err(strs, ...dyn) {
    let msg = strs[0];
    for (let i = 0; i < dyn.length; ++i) {
        msg += JSON.stringify(dyn[i]) + strs[i + 1];
    }
    return new Error(msg);
}

const HASH_COMMENT_PRECEDER = /[\t\n\r (]$/;

function heredocLabel(startDelim) {
    return startDelim.substring(startDelim[2] == '-' ? 3 : 2);
}

function heredocBodyRegExp(label) {
    return new RegExp(
      // Maximal run of non-CRLF characters or a CRLF character
      // that is not followed by the label and a newline after
      // a run of spaces or tabs.
      '^(?:[^\n\r]|(?![\n\r]' + label + '[\r\n])[\n\r])*');
}

/**
 * Returns a function that can be fed chunks of input and
 * which returns the context in which interpolation occurs.
 * If the returned function is fed null, then it will
 * throw an error only if not in a valid end context.
 */
function makeLexer() {
    // A stack of (
    //     start delimiter,
    //     position of start in concatenation of chunks,
    //     position of start in current chunk)
    //     delimiter length in chunk
    // for each start delimiter for which we have not yet seen
    // an end delimiter.
    const delimiterStack = [Object.freeze(['', 0, 0, 0])];
    let position = 0;

    return (wholeChunk) => {
        if (wholeChunk === null) {
            // Test can end.
            if (delimiterStack.length !== 1) {
                throw err`Cannot end in contexts ${delimiterStack.join(' ')}`;
            }
        } else {
            let origChunk = String(wholeChunk);
            // A suffix of origChunk that we consume as we tokenize.
            let chunk = origChunk;
            while (chunk) {
                const top = delimiterStack[delimiterStack.length - 1];
                const topStartDelim = top[0];
                let v = DELIMS[topStartDelim], bodyRegExp;
                if (v) {
                    bodyRegExp = v.bodyRegExp;
                } else if (topStartDelim[0] === '<'
                           && topStartDelim[1] === '<') {
                    bodyRegExp = heredocBodyRegExp(heredocLabel(topStartDelim));
                    v = DELIMS['<<'];
                }
                let m = bodyRegExp.exec(chunk);
                if (!m) {
                    // Can occur if a chunk ends in '\\' and bodyPattern
                    // allows escapes.
                    throw err`Unprocessable content ${chunk} in context ${top}`;
                }

//                console.log('chunk=' + JSON.stringify(chunk) + ', top=' + JSON.stringify(top) + ', consumed body chunk ' + JSON.stringify(m));

                chunk = chunk.substring(m[0].length);
                position += m[0].length;

                m = v.endRegExp.exec(chunk);
                if (chunk.length !== 0) {
                    if (m) {
                        if (delimiterStack.length === 1) {
                            // Should never occur since DELIMS[''] does not have
                            // any end delimiters.
                            throw err`Popped past end of stack`;
                        }
                        --delimiterStack.length;
                        chunk = chunk.substring(m[0].length);
                        position += m[0].length;
                        continue;
                    } else if (v.nests.length) {
                        m = v.startRegExp.exec(chunk);
                        if (m) {
                            let start = m[0];
                            let delimLength = start.length;
                            if (start === '#') {
                                const chunkStartInWhole =
                                      origChunk.length - chunk.length;
                                if (chunkStartInWhole === 0) {
                                    // If we have a chunk that starts with a
                                    // '#' then we don't know whether two
                                    // ShFragments can be concatenated to
                                    // produce an unambiguous ShFragment.
                                    // Consider
                                    //    sh`foo ${x}#bar`
                                    // If x is a normal string, it will be
                                    // quoted, so # will be treated literally.
                                    // If x is a ShFragment that ends in a space
                                    // '#bar' would be treated as a comment.
                                    throw err`'#' at start of ${chunk} is a concatenation hazard.  Maybe use \#`;
                                } else if (!HASH_COMMENT_PRECEDER.test(origChunk.substring(0, chunkStartInWhole))) {
                                    // A '#' is not after whitespace, so does
                                    // not start a comment.
                                    chunk = chunk.substring(1);
                                    position += 1;
                                    continue;
                                }
                            } else if (start === '<<' || start === '<<-') {
                                // If the \w+ part below changes, also change the \w+ in fixupHeredoc.
                                let fullDelim = /^<<-?[ \t]*(\w+)[ \t]*[\n\r]/
                                    .exec(chunk);
                                // http://pubs.opengroup.org/onlinepubs/009695399/utilities/xcu_chap02.html#tag_02_03 defines word more broadly.
                                // We can't handle that level of complexity here
                                // so fail for all heredoc that do not match word.
                                if (!fullDelim) {
                                    throw err`Failed to find heredoc word at ${word}.  Use a nonce generator instead of .`
                                }
                                start += fullDelim[1];
                                delimLength = fullDelim[0].length;
                            }
                            delimiterStack.push(
                              Object.freeze([start, position,
                                             origChunk.length - chunk.length,
                                             delimLength]));
                            chunk = chunk.substring(delimLength);
                            position += m[0].length;
                            continue;
                        }
                    }
                    throw err`Non-body content remaining ${chunk} that has no delimiter in context ${top}`;
                }
            }
        }
        return delimiterStack[delimiterStack.length - 1];
    };
}

/**
 * A string wrapper that marks its content as a series of
 * well-formed SQL tokens.
 */
function ShFragment(s) {
    const content = String(s);
    if (!(this instanceof ShFragment)
        || Object.hasOwnProperty.call(this, 'content')) {
        return new ShFragment(content);
    }
    this.content = content;
}
ShFragment.prototype.toString = function () {
    return String(this.content);
};

// Maps frozen string lists to contexts computed from them.
const memoTable = new WeakMap();

function compose(staticStrings, ...dynamicValues) {
    const trusted = staticStrings.raw;
    const untrusted = dynamicValues;
    const n = untrusted.length;

    // Collect an array of parsing decisions so that
    // we don't need to rerun the lexer when a particalar tag use
    // is executed multiple times.
    let lexer = null;
    // If we haven't memoized it, but can, this is an array of
    // contexts that we can replay.
    let contexts = null;
    if (Object.isFrozen(staticStrings) && Object.isFrozen(trusted)) {
        let lexMaker = memoTable.get(staticStrings);
        if (lexMaker) {
            lexer = lexMaker();
        } else {
            contexts = [];
        }
    }

    if (!lexer) {
        lexer = makeLexer();
    }
    let t = String(trusted[0]);
    let context = lexer(t);
    // A buffer onto which we accumulate output.
    let buf = [t];
    for (let i = 0; i < n; ++i) {
        if (contexts) {
            contexts.push(context);
        }
        let value = untrusted[i];
        let delim = context[0];
        if (delim[0] === '<') { delim = '<<'; }
        let embedder = DELIMS[delim].embed;
        t = String(trusted[i + 1]);
        buf.push(embedder(value, buf, context), t);
        let newContext = lexer(t);
        if (context !== newContext
            && delim[0] === '<' && delim[1] === '<') {
            fixupHeredoc(buf, context, newContext);
        }
        context = newContext;
    }

    lexer(null);  // Check valid end state.

    if (contexts) {
        memoTable.set(
          staticStrings,
          () => {
              let i = 0;
              return (_) => contexts[i++];
          });
    }
    return new ShFragment(buf.join(''));
}

function fixupHeredoc(buf, context) {
    let [delim, contextStart, contextOffset, delimLength] = context;
    let chunkLeft = 0;
    let startChunkIndex = -1;
    for (let i = 0, n = buf.length; i < n; ++i) {
        chunkLeft += buf[i].length;
        if (chunkLeft >= contextStart) {
            startChunkIndex = i;
            break;
        }
    }
    if (startChunkIndex === -1) {
        throw err`Cannot find heredoc start for ${context}`;
    }
    let label = heredocLabel(delim);
    let endChunkIndex = buf.length - 1;

    // Figure out how much of the last chunk is part of the body.
    let bodyRe = heredocBodyRegExp(label);
    let endChunk = buf[endChunkIndex];
    let lastBodyMatch = bodyRe.exec(endChunk);
    if (lastBodyMatch[0].length === endChunk.length) {
        throw err`Could not find end of ${delim}`;
    }

    let startChunk = buf[startChunkIndex];
    let body = startChunk.substring(contextOffset + delimLength);
    for (let i = startChunkIndex + 1; i < endChunkIndex; ++i) {
        body += buf[i];
    }
    body += lastBodyMatch[0];

//    console.log('buf=' + JSON.stringify(buf) + '\ncontext=' + JSON.stringify(context) + '\nstartChunkIndex=' + startChunkIndex + '\nendChunkIndex=' + endChunkIndex + "\nbody=" + JSON.stringify(body));

    // Look for a premature end delimiter by looking at newline followed by body.
    let testBody = "\n" + body;
    if (bodyRe.exec(testBody)[0].length !== testBody.length) {
        // There is an embedded delimiter.
        // Choose a suffix that an attacker cannot predict.
        // An attacker would need to be able to generate sha256
        // collisions to embed both NL <label> and NL <label> <suffix>.
        let suffix = '_' +
            crypto.createHash('sha256')
            .update(body, 'utf8')
            .digest('base64')
            .replace(/=+$/, '');
        let newLabel = label + suffix;
        let newBodyRe = heredocBodyRegExp(newLabel);
        if (!newBodyRe.exec(testBody)[0].length === testBody.length) {
            throw err`Cannot solve embedding hazard in ${body} in heredoc with ${label} due to hash collision`
        }

        let endDelimEndOffset = lastBodyMatch[0].length +
            endChunk.substring(lastBodyMatch[0].length)
            // If the \w+ part below changes, also change the \w+ in the lexer
            // after the check for << and <<- start delimiters.
            .match(/[\r\n]\w+/)[0].length;
        buf[startChunkIndex] = (
          startChunk.substring(0, contextOffset + delimLength)
            .replace(/[\r\n]+$/, '')
            + suffix + '\n'
            + startChunk.substring(contextOffset + delimLength));
        buf[endChunkIndex] = (
          endChunk.substring(0, endDelimEndOffset)
            + suffix
            + endChunk.substring(endDelimEndOffset));
    }
}


module.exports = compose;
module.exports.ShFragment = ShFragment;

if (global.it) {
    // Expose for testing.
    // Harmless if this leaks
    module.exports.makeLexer = makeLexer;
}
