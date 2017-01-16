# Should we hire that dev?

[![Build Status](https://travis-ci.org/tschortsch/should-we-hire-that-dev.svg?branch=master)](https://travis-ci.org/tschortsch/should-we-hire-that-dev)

## Installation

### Heroku setup

* heroku buildpacks:set https://github.com/heroku/heroku-buildpack-php --app shouldwehirethatdev
* heroku config:set GH_CLIENT_ID=<CLIENT_ID_FROM_GITHUB> --app shouldwehirethatdev
* heroku config:set GH_CLIENT_SECRET=<CLIENT_SECRET_FROM_GITHUB> --app shouldwehirethatdev
