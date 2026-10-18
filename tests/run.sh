#!/usr/bin/env bash
# Unit tests for the pure parts of lib/ (parsers, formatters, netload arithmetic). No shell needed.
set -euo pipefail
cd "$(dirname "$0")/.."
# Number formatting follows the locale; the expectations are written for en_US.
export LC_ALL=en_US.UTF-8
status=0
for test in tests/test-*.js; do
    gjs -m "$test" || status=1
done
exit $status
