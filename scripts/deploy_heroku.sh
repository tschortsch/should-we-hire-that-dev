#!/bin/bash

# fail on first error
set -e

DIR=`dirname $0`

echo "--- before deploy ---"
npm install
gulp styles
echo "Styles task complete!"
