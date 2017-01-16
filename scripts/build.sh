#!/bin/bash

# fail on first error
set -e

DIR=`dirname $0`

echo "starting build..."

echo "compiling assets"
gulp deploy

echo "build finished!"
