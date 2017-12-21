# Buffer Overflow

A buffer overflow occurs when code fails to check an index into an
array while unpacking input, allowing parts of that input to overwrite
memory locations that other trusted code assumes are inviolable.
A similar technique also allows exfiltrating data like cryptographic keys
when an unchecked limit leads to copying unintended memory locations into
an output.

Buffer overflow vectors in Node.js are:

*  The Node.js runtime and dependencies like the JS runtime and OpenSSL
*  [C++ addons][] third-party modules that use N-API (the native API).
*  Child processes.  For example, code may route a request body to an
   [image processing library][imagetragick] that was not
   written with untrusted inputs in mind.

Buffer overflows are common, but we class them as low frequency for
Node.js in particular.  The runtime is highly reviewed compared to the
average C++ backend; C++ addons are a small subset of third-party
modules; and there's no reason to believe that child processes spawned
by Node.js applications are especially risky.

[imagetragick]: https://imagetragick.com/
[C++ addons]: https://nodejs.org/api/addons.html#addons_c_addons
