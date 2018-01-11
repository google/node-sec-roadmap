# Threat environment

The threat environment for Node.js is similar to that for other runtimes that
are primarily used for microservices and web frontends, but there are some
Node.js specific concerns.

We define both kinds of threats in this section.  A reader familiar with
web-application security can skip all but this page and the discussion
of [*unintended require*][UIR] without missing much, but may find it
helpful to refer back to the table below when reading later chapters.

## Server vs Client-side JavaScript

Before we discuss the threat environment, it's worth noting that the threat
environment for server-side JavaScript is quite different from that for
client-side JavaScript.  For example,

* Client-side JavaScript runs in the context of the
  [same-origin policy][] possibly with a
  [Content-Security-Policy][CSP] which governs which code can load.
  Server-side JavaScript **code loading** is typically only
  constrained by the files on the server, and the values that can
  reach `require(...)`, `eval(...)` and similar operators.
* Client-side JavaScript typically only has access to data that the
  human using the browser should have access to.  On the server,
  applications are responsible for **data [compartmentalization][]**,
  and server-side JavaScript often has privileged access to storage
  systems and other backends.
* **File-system access** by the client typically either requires human
  interaction
  (`<input type=file>`, `Content-disposition:attachment`), or can only access
  a directory dedicated to third-party content (browser cache, local storage)
  and which is not usually on a list like `$PATH`.
  On the server, the Node runtime process's privileges determine
  [file-system access][nodejs/fs].
* Client-side JavaScript has no concept of a **shell** that converts
  strings into commands that runs outside the JavaScript engine.
  Server-side JavaScript can spawn
  [child processes][nodejs/child_process] that operate on data
  received over the network, and on data that is accessible to the
  Node runtime process.
* **Network messages** sent by server-side JavaScript originate inside
  the server's LAN, but those sent by client-side JavaScript typically do not.
* **Shared memory concurrency** in client-side JavaScript happens via
  well-understood APIs like `SharedArrayBuffer`.  Experimental modules
  ([code][threads-a-gogo]) and a [workers proposal][]
  allow server-side JavaScript to fork threads; it is
  unclear how widespread these are in production or how
  [susceptible][thread corner cases] these are to memory corruption
  or exploitable race conditions.

The threat environment for server-side JavaScript is much closer to
that for any other server-side framework than JavaScript in the
browser.

## Classes of Threats {#threat_table}

The table below lists broad classes of vulnerabilities, and for each,
a short identifier by which we refer to the class later in this
document.  This list is not meant to be comprehensive, but we expect
that a thorough security assessment would touch on most of these and
would have low confidence in an assessment that skips many.

The frequency and severity of vulnerabilities are guesstimates since
we have little hard data on the frequency of these in Node.js
applications, so have extrapolated from similar systems.  For example,
see discussion about frequency in [buffer overflow][BOF].

For each, relevant mitigation strategies appear in the mitigations
columns, and link to the discussion.

| Shorthand | Description                                                                           | Frequency | Severity | Mitigations                 |
| --------- | ------------------------------------------------------------------------------------- | --------- | -------- | --------------------------- |
| [0DY][]   | Zero-day.  Attackers exploit a vulnerability before a fix is available.               | Low-Med   | Med-High | [cdeps][m-cd] [fail][m-fa]  |
| [BOF][]   | Buffer overflow.                                                                      | Low       | High     | [ovrsi][m-os]               |
| [CRY][]   | Misuse of crypto leads to poor access-control decisions or data leaks.                | Medium    | Medium   | [ovrsi][m-os]               |
| [DEX][]   | Poor developer experience slows or prevents release of features.                      | ?         | ?        | [dynam][m-dy] [ovrsi][m-os] |
| [EXF][]   | Exfiltration of data, e.g. by exploiting reflection to serialize more than intended.  | Med-High  | Low-Med  | [ovrsi][m-os]               |
| [LQC][]   | Using low quality dependencies leads to exploit                                       | Medium    | Low-Med  | [kdeps][m-kd] [ovrsi][m-os] |
| [MTP][]   | Theft of commit rights or MITM causes `npm install` to fetch malicious code.          | Low       | Med-High | [kdeps][m-kd] [cdeps][m-cd] |
| [QUI][]   | Query injection on a production machine.                                              | Medium    | Med-High | [ovrsi][m-os] [qlang][m-ql] |
| [RCE][]   | Remote code execution, e.g. via `eval`                                                | Med-High  | High     | [dynam][m-dy] [ovrsi][m-os] |
| [SHP][]   | Shell injection on a production machine.                                              | Low       | High     | [ovrsi][m-os] [cproc][m-cp] |
| [UIR][]   | `require(untrustworthyInput)` loads code not intended for production.                 | Low       | Low-High | [dynam][m-dy]               |


## Meltdown and Spectre

As of this writing, the security community is trying to digest
the implications of *Meltdown* and *Spectre*.  The
[Node.js blog][Meltdown Spectre Impact] addresses them from a
Node.js perspective, so we do not comment in depth.

It is worth noting though that those vulnerabilities lead to
breaches of *confidentiality*.  While confidentiality violations
are serious, the suggestions that follow use design principles
that prevent a violation of confidentiality from causing a
violation of *integrity*.  Specifically:

*  Knowing a whitelist of production source hashes does not
   allow an attacker to cause a non-production source to load.
*  Our runtime `eval` mitigation relies on JavaScript reference
   equality, not knowledge of a secret.


[same-origin policy]: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
[CSP]: https://developers.google.com/web/fundamentals/security/csp/
[compartmentalization]: https://cwe.mitre.org/data/definitions/653.html
[nodejs/fs]: https://nodejs.org/api/fs.html
[nodejs/child_process]: https://nodejs.org/api/child_process.html
[threads-a-gogo]: https://github.com/xk/node-threads-a-gogo/blob/74005641d53b0d85e8d75e2506eddbded15f5112/src/threads_a_gogo.cc#L1387
[workers proposal]: https://github.com/nodejs/worker/issues/2
[thread corner cases]: https://github.com/nodejs/worker/issues/4#issuecomment-306090967
[Query Injection]: https://cwe.mitre.org/data/definitions/89.html
[0DY]: threat-0DY.md
[BOF]: threat-BOF.md
[CRY]: threat-CRY.md
[DEX]: threat-DEX.md
[EXF]: threat-EXF.md
[LQC]: threat-LQC.md
[MTP]: threat-MTP.md
[QUI]: threat-QUI.md
[RCE]: threat-RCE.md
[SHP]: threat-SHP.md
[UIR]: threat-UIR.md
[m-dy]: ../chapter-2/dynamism.md
[m-kd]: ../chapter-3/knowing_dependencies.md
[m-cd]: ../chapter-4/close_dependencies.md
[m-os]: ../chapter-5/oversight.md
[m-fa]: ../chapter-6/failing.md
[m-cp]: ../chapter-7/child-processes.md
[m-ql]: ../chapter-7/query-langs.md
[Meltdown Spectre Impact]: https://nodejs.org/en/blog/vulnerability/jan-2018-spectre-meltdown/
