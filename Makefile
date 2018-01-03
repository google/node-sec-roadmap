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
	@cat book.json.withcomments | perl -ne 'print unless m/^[ \t]*#/' > book.json

book : www/.tstamp check

pdf : book.pdf

book.pdf : node_modules book.json README.md SUMMARY.md $(wildcard chapter-*/*.md) appendix/README.md CONTRIBUTORS.md styles/website.css images/*
	PATH="${PATH}:./node_modules/.bin/:${CALIBRE_HOME}" ./node_modules/.bin/gitbook pdf

www/.tstamp : node_modules book.json README.md SUMMARY.md $(wildcard chapter-*/*.md) appendix/README.md CONTRIBUTORS.md styles/website.css images/*
	"${ROOT_DIR}"/node_modules/.bin/gitbook build . www
	touch www/.tstamp

check : check.tstamp

check.tstamp : www/.tstamp
	touch check.tstamp
	@! find www/ -name \*.html \
	    | xargs egrep '\]\[|[nN][oO][dD][eE]J[sS]|\bN[Pp][Mm]\b' \
	    | egrep -v 'x\[a\]\[b\]|this\[x\]\['
	@if [ "${HTML_PROOFER}" = "/bin/echo" ]; then \
		echo "Warning: HTML_PROOFER not available"; \
	else \
		echo Running htmlproofer; \
		"${HTML_PROOFER}" \
		  --alt-ignore=example/graphs/full.svg \
		  --url-ignore="https://github.com/google/node-sec-roadmap/,https://github.com/google/node-sec-roadmap/issues,../node-sec-roadmap.pdf,node-sec-roadmap.pdf,https://github.com/google/node-sec-roadmap/tree/master/appendix,https://github.com/google/node-sec-roadmap/tree/master/chapter-7/examples/sh,https://github.com/google/node-sec-roadmap/tree/master/chapter-7/examples/sql,https://github.com/google/node-sec-roadmap/tree/master/chapter-2/experiments/webpack-compat,https://github.com/google/node-sec-roadmap/blob/6130b76446ff4efbb276d8128c12e41ea2fffbc9/chapter-2/example/make_dep_graph.sh#L39-L73,https://github.com/google/node-sec-roadmap/blob/master/chapter-2/example/make_dep_graph.sh" \
		  "${ROOT_DIR}"/www/; \
	fi

serve : book
	"${ROOT_DIR}"/node_modules/.bin/gitbook serve

serve_static_files : book
	pushd www; python -m SimpleHTTPServer 4000; popd

clean :
	rm -rf www/ book.pdf _book book.json deploy/

node_modules : package.json
	npm install --only=prod
	touch node_modules/

deploy: book pdf
	rm -rf deploy/
	mkdir deploy/
	cp app.yaml deploy/
	cp book.pdf deploy/node-sec-roadmap.pdf
	cp -r www/ deploy/www/
