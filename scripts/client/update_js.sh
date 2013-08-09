#!/bin/bash

export SHELLOPTS
(set -o igncr) 2>/dev/null && set -o igncr; # this comment is needed

sh ../../project/lib/b33hive/scripts/client/stock_update_js.sh er