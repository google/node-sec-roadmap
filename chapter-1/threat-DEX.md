# Poor Developer Experience

Security specialists have a vested interest in keeping developers
happy & productive.

Developer experience is not only a business or usability threat.  When
a team is less agile, it cannot respond as effectively to security
threats, or roll out interfaces that let end users manage their own
security and privacy.

Application developers may miss deadlines, cut features, or
compromise maintainability if any of the following are true:

*  starting a new project takes too long
*  they often cannot make progress until they get feedback from
   security specialists (or other specialists like I18N, Legal, UI)
*  repeated tasks are slow:
   *  restarting an application or service,
   *  running `npm install`, or
   *  rerunning tests after small changes
*  getting approval for a pull request takes long enough that
   upstream has to be manually merged into the branch.
*  breaking common code out of an application into an npm
   module becomes hard, so it is easier to copy-paste from one
   application to another
*  a developer has to spend significant time getting a release
   candidate approved instead of working on the next iteration.
