#!/bin/bash

set -e

# Release-dance code goes here.

# Constants
PRODUCT="Juris-M Abbreviation Filter: abbreviation list editing and maintenance"
IS_BETA="false"
FORK="abbrevs-filter"
BRANCH="master"
CLIENT="abbrevs-filter"
VERSION_ROOT="1.1."

function build-the-plugin () {
    set-install-version
    find . -name '.hg' -prune -o \
        -name '.hgignore' -prune -o \
        -name '.gitmodules' -prune -o \
        -name '*~' -prune -o \
        -name '.git' -prune -o \
        -name 'attic' -prune -o \
        -name '.hgsub' -prune -o \
        -name '.hgsubstate' -prune -o \
        -name '*.bak' -prune -o \
        -name '*.tmpl' -prune -o \
        -name 'version' -prune -o \
        -name 'releases' -prune -o \
        -name 'sh-lib' -prune -o \
        -name 'build.sh' -prune -o \
        -print | xargs zip "${XPI_FILE}" >> "${LOG_FILE}"
    }
    
. jm-sh/frontend.sh
