#!/bin/bash

# fail on first error
set -e

DIR=`dirname $0`

echo "starting build..."

echo "compiling assets"
node_modules/.bin/gulp deploy

echo "build finished!"
