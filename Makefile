# This Makefile builds various versions of the Gitbook, runs
# sanity checks, and sets up a deployment directory.
#
# See `make help`

define HELP
Targets
=======
`make book`         puts HTML files under www/
`make pdf`          builds the PDF version
`make serve_static` serve the book from http://localhost:4000/
`make serve`        launch the builtin gitbook debug server
`make check`        runs sanity checks
`make deploy`       builds the deployment directory and runs checks

Setup
=====
This assumes that PATH includes
   https://github.com/gjtorikian/html-proofer
   https://calibre-ebook.com/download
that the following environment variables point to reasonable values:
   HTML_PROOFER   # path to htmlproofer executable
   CALIBRE_HOME   # path to directory containing calibre executables

Deploying
=========
`make deploy` builds the deploy directory.
From that directory `gcloud app deploy --project node-sec-roadmap`
deploys to the canonical location if you have the right
privileges and have run `gcloud auth login`.
endef
export HELP


ROOT_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

# External dependency used to detect dead links
ifeq ($(HTML_PROOFER),)
  HTML_PROOFER:=${HOME}/.gem/ruby/2.4.0/gems/html-proofer-3.7.4/bin/htmlproofer
  ifeq (,$(wildcard ${HTML_PROOFER}))
	HTML_PROOFER:=/bin/echo
  endif
endif

# External dependency used to build pdf
ifeq ($(CALIBRE_HOME),)
  CALIBRE_HOME:=/Applications/calibre.app/Contents/console.app/Contents/MacOS/
endif


# Bits that gitbook depends on
GITBOOK_DEPS := node_modules book.json cover.md SUMMARY.md CONTRIBUTORS.md \
		$(wildcard chapter-*/*.md) appendix/experiments.md \
		styles/website.css images/*


help:
	@echo "$$HELP"

book.json : book.json.withcomments
	@cat book.json.withcomments \
	| perl -ne 'print unless m/^[ \t]*#/' > book.json

pdf : www/node-sec-roadmap.pdf
www/node-sec-roadmap.pdf : $(GITBOOK_DEPS)
	PATH="${PATH}:./node_modules/.bin/:${CALIBRE_HOME}" \
	    ./node_modules/.bin/gitbook pdf . www/node-sec-roadmap.pdf

book : www/.book.tstamp
www/.book.tstamp : $(GITBOOK_DEPS)
	"${ROOT_DIR}"/node_modules/.bin/gitbook build . www
	@touch www/.book.tstamp

check : .check.tstamp
.check.tstamp : deploy/.deploy.tstamp
	touch .check.tstamp
	@! find deploy/www/ -name \*.html \
	    | xargs egrep '\]\[|[nN][oO][dD][eE]J[sS]|\bN[Pp][Mm]\b' \
	    | egrep -v 'x\[a\]\[b\]|this\[x\]\['
	@if [ "${HTML_PROOFER}" = "/bin/echo" ]; then \
		echo "Warning: HTML_PROOFER not available"; \
	else \
		echo Running htmlproofer; \
		"${HTML_PROOFER}" \
		  --alt-ignore=example/graphs/full.svg \
		  "${ROOT_DIR}"/deploy/www/; \
	fi
	@find deploy -name node_modules \
	    || (echo "deploy/ should not include node_modules"; false)

serve : book
	"${ROOT_DIR}"/node_modules/.bin/gitbook serve

serve_static_files : book
	pushd www; python -m SimpleHTTPServer 4000; popd

clean :
	rm -rf www/ deploy/ _book/ book.json .*.tstamp

node_modules : package.json
	npm install --only=prod
	@touch node_modules/

deploy : deploy/.deploy.tstamp check
deploy/.deploy.tstamp : book pdf app.yaml
	rm -rf deploy/
	mkdir deploy/
	cp app.yaml deploy/
	cp -r www/ deploy/www/
	@touch deploy/.deploy.tstamp
