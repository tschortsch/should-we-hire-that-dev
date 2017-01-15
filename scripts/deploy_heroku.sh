#!/bin/bash

# fail on first error
set -e

DIR=`dirname $0`

gulp styles
echo "Styles task complete!"
