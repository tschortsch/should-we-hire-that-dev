#!/bin/bash

# fail on first error
set -e

DIR=`dirname $0`

echo "before deploy..."
echo "setting php buildpack"
heroku buildpacks:set heroku/php
echo "before deploy finished!"
