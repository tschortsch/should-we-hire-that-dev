#!/bin/bash

# fail on first error
set -e

DIR=`dirname $0`

echo "starting build..."

echo "installing npm dependencies"
npm install --dev
echo "compiling css assets"
gulp styles

echo "build finished!"
