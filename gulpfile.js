const { series, parallel, src, dest, watch } = require('gulp');

const del = require('del');
const fs = require('fs');

const webpack = require('webpack-stream');
const sass = require('gulp-sass');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');
const tar = require('gulp-tar');
const GulpSSH = require('gulp-ssh');

const sshConfig = {
	host: '0.0.0.0',
	port: 22,
	username: 'username',
	// privateKey: fs.readFileSync('/Users/user/.ssh/id_rsa')
};
const ssh = new GulpSSH({
	ignoreErrors: false,
	sshConfig: sshConfig
});

function clean() {
	return del([
		'dist'
	]);
}

function templates() {
	return src([
			'src/**/*.html',
			'!src/markup.html',
			'!src/standalone.html'
		])
		.pipe(dest('dist/'));
}

function styles() {
	return src('src/css/main.scss')
		.pipe(sourcemaps.init())
		.pipe(sass({
			errorLogToConsole: true,
			outputStyle: 'compressed'
		}))
		.on('error', (error) => { console.error(error.toString()); })
		.pipe(rename({
			basename: 'style',
			suffix: '.min',
			extname: '.css'
		}))
		.pipe(sourcemaps.write('./'))
		.pipe(dest('dist/css/'));
}

function scripts() {
	return src('src/js/main.js')
		.pipe(webpack(require('./webpack.config.js')))
		.pipe(dest('dist/'));
}

function res(cb) {
	src('src/img/**/*')
		.pipe(dest('dist/img/'));

	src('src/fonts/**/*')
		.pipe(dest('dist/fonts/'));

	src('src/docs/**/*')
		.pipe(dest('dist/docs/'));

	src([
			'src/favicon.ico',
			'src/icon.png',
			'src/site.webmanifest',
		])
		.pipe(dest('dist/'));

	cb();
}

function dev() {
	watch([
		'src/index.html',
		'src/pages/**/*.html',
		'src/templates/**/*.html'
	], series(templates));

	watch([,
		'src/css/**/*.scss'
	], series(styles));

	watch([,
		'src/js/**/*.js'
	], series(scripts));
}

function deployUp() {
	if (sshConfig.host === '0.0.0.0')
		return console.error('Unable to deploy, SSH config needed.');

	return src('dist/**/*', { base: '.' }) // base '.' to use whole 'dist' folder
		.pipe(tar('package.tar'))
		.pipe(dest('dist'))
		.pipe(ssh.dest('/home/user/dist'));
}

function deployRemote() {
	return ssh.shell([
			'tar -xvf package.tar',
			'rsync -av --delete /home/user/dist/ /var/www/html/',
			'rm package.tar',
			'rm -r /home/user/dist',
		], { filePath: 'deploy-shell.log' });
}

function deployDown() {
	return del(['dist/package.tar']);
}

exports.default = series(clean, parallel(templates, styles, scripts, res), dev);
exports.dev = exports.default;
exports.dist = series(clean, parallel(templates, styles, scripts, res));
exports.deploy = series(deployUp, deployRemote, deployDown);

