var gulp = require('gulp'),
    sass = require('gulp-sass'),
    //concat = require('gulp-concat'),
    //uglify = require('gulp-uglify'),
    notify = require('gulp-notify'),
    sourcemaps = require('gulp-sourcemaps'),
    autoprefixer = require('gulp-autoprefixer');

gulp.task('default', function () {
});

gulp.task('styles', function () {
    return gulp.src('./assets/scss/styles.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle: 'compressed'
        }).on('error', sass.logError))
        .pipe(autoprefixer('last 2 version'))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./assets/css'));
});

gulp.task('scripts', function () {
    return gulp.src([
            './assets/external/jquery.easing/jquery.easing.js',
            './assets/external/bootstrap-sass/assets/javascripts/bootstrap.js',
            './assets/external/Leaflet/dist/leaflet-src.js',
            './assets/external/Leaflet.markercluster/dist/leaflet.markercluster-src.js',
            './assets/js/app.js'
        ])
        .pipe(concat('app.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./assets/js'));
});

gulp.task('deploy', [ 'styles', 'scripts' ]);
