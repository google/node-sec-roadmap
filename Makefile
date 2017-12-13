ROOT_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

# External dependency used to detect dead links
ifeq ($(HTML_PROOFER),)
  HTML_PROOFER:=${HOME}/.gem/ruby/2.4.0/gems/html-proofer-3.7.4/bin/htmlproofer
  ifeq (,$(wildcard ${HTML_PROOFER}))
	HTML_PROOFER:=/bin/echo
  endif
endif

# External dependency used to build pdf
ifeq ($(CALIBER_HOME),)
  CALIBRE_HOME:=/Applications/calibre.app/Contents/console.app/Contents/MacOS/
endif

book.json : book.json.withcomments
	@cat book.json.withcomments | perl -ne 'print unless m/^\s*#/' > book.json

book : gitbook_out/.tstamp check

pdf : node_modules
	PATH="${PATH}:./node_modules/.bin/:${CALIBRE_HOME}" ./node_modules/.bin/gitbook pdf

gitbook_out/.tstamp : node_modules book.json README.md SUMMARY.md $(wildcard chapter-*/*.md) appendix/README.md CONTRIBUTORS.md styles/website.css
	"${ROOT_DIR}"/node_modules/.bin/gitbook build . gitbook_out
	touch gitbook_out/.tstamp

check :
	@! find gitbook_out/ -name \*.html \
	    | xargs egrep '\]\[|[nN][oO][dD][eE]J[sS]|\bN[Pp][Mm]\b' \
	    | egrep -v 'x\[a\]\[b\]|this\[x\]\['
	@if [ "${HTML_PROOFER}" = "/bin/echo" ]; then \
		echo "Warning: HTML_PROOFER not available"; \
	else \
		echo Running htmlproofer; \
		"${HTML_PROOFER}" \
		  --alt-ignore=example/graphs/full.svg \
		  --url-ignore="https://github.com/google/node-sec-roadmap/,https://github.com/google/node-sec-roadmap/issues,../book.pdf,book.pdf" \
		  "${ROOT_DIR}"/gitbook_out/; \
	fi

serve : book
	"${ROOT_DIR}"/node_modules/.bin/gitbook serve
#	pushd gitbook_out; python -m SimpleHTTPServer 8000; popd

clean :
	rm -rf gitbook_out/ book.pdf _book book.json

node_modules : package.json
	npm install --only=prod
	touch node_modules/
