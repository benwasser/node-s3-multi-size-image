var gm = require('gm');
var async = require('async');
var knox_lib = require('knox');
var knox;
var initialized = false;
var s3_options;

module.exports = {
	initialize: function(options){
		if (!options || !options.s3_key || !options.s3_secret || !options.s3_bucket || !options.s3_region){
			return callback('Missing S3 options parameters', null);
		};
		s3_options = options;
		knox = knox_lib.createClient({
		    key: options.s3_key,
		    secret: options.s3_secret,
		    bucket: options.s3_bucket,
		    region: options.s3_region,
		});
		initialized = true;
		return this;
	},
	image_redirect: function(url, callback) {
		var temp_path = url.substr(url.indexOf('msicdn_') + 7);
		temp_path = temp_path.substr(0, temp_path.indexOf('.'));
		var temp_size = url.substr(url.indexOf('?size=') + 6).toLowerCase();
		if (temp_size.indexOf('&') != -1) temp_size = temp_size.substr(0, temp_size.indexOf('&'));
		if (url.indexOf('?') != -1) url = url.substr(0, url.indexOf('?'));
		if (url.indexOf('#') != -1) url = url.substr(0, url.indexOf('#'));
		var temp_extension = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|svg)$/)[1];
		if (temp_extension != 'jpg') temp_size = 'original';
		callback(null, 'https://' + s3_options.s3_bucket + '.s3-' + s3_options.s3_region + '.amazonaws.com/' + temp_path + '_' + temp_size + '.' + temp_extension);
	},
	upload: function(file_path, options, callback) {
		//check if missing arguments
		if (arguments.length == 2) {
			if (Object.prototype.toString.call(options) == "[object Function]") {
				callback = options;
				options = {};
			}
		}
		if (!options.sizes || !options.sizes.length) options.sizes = [
			'thumb', 'small', 'blog', 'large', 'original'
		];
		
		if (!initialized) return callback('You must call initialize first with your S3 credentials', null);
		if (!file_path) return callback('You must include the image file path', null);
		if (!file_path.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|svg)$/)) return callback('Not a valid image file format', null);
		
		var s3_urls = {};
		
		//check if it's not resizeable:
		var old_sizes = JSON.parse(JSON.stringify(options.sizes));
		if (!file_path.toLowerCase().match(/(jpg|jpeg|png|bmp)$/)){
			options.sizes = ['original'];
		};
		
		var output_path_base = '/' + (new Date().getTime()) + '_';
		
		async.each(options.sizes, function(suffix, callback) {
			module.exports[suffix](file_path, output_path_base, function(err, url){
				if (err) return callback(err);
				s3_urls[suffix] = url;
				callback();
			});
		}, function(err){
			if (err) {
				callback(err, null);
			} else {
				//go through and fill in the original url for each of the sizes:
				if (!file_path.toLowerCase().match(/(jpg|jpeg|png|bmp)$/)){
					for (var i = 0; i < old_sizes.length; i++) {
						if (old_sizes[i] != 'original'){
							s3_urls[old_sizes[i]] = s3_urls.original;
						}
					}
				};
				//this provides a base that you can use in your routing and append querystrings to it to handle the different sizes:
				if (!file_path.toLowerCase().match(/(jpg|jpeg|png|bmp)$/)){
					s3_urls.redirect_base = 'msicdn_' + output_path_base.replace('_', '.').replace('/', '') + file_path.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|svg)$/)[1];
				} else {
					s3_urls.redirect_base = 'msicdn_' + output_path_base.replace('_', '.').replace('/', '') + 'jpg';
				}
				callback(null, s3_urls);
			}
		});
	},
	original: function(path, output_path_base, callback) {
		module.exports.directUpload(path, output_path_base, 'original', function(err, url){
			if (err) return callback(err, null);
			callback(null, url);
		});
	},
	thumb: function(path, output_path_base, callback) {
		var height = 100;
		var width = 100;
		var new_temp_file_path = '/tmp/' + (new Date().getTime()) + '_thumb.jpg';
		gm(path).autoOrient().noProfile().gravity('Center').thumb(width, height, new_temp_file_path, 100, function(){
			module.exports.directUpload(new_temp_file_path, output_path_base, 'thumb', function(err, url){
				if (err) return callback(err, null);
				callback(null, url);
			});
		});
	},
	small: function(path, output_path_base, callback) {
		var height = 300;
		var width = 300;
		var new_temp_file_path = '/tmp/' + (new Date().getTime()) + '_small.jpg';
		gm(path).autoOrient().noProfile().resize(width, height, '>').compress('JPEG').quality(90).write(new_temp_file_path, function () {
			module.exports.directUpload(new_temp_file_path, output_path_base, 'small', function(err, url){
				if (err) return callback(err, null);
				callback(null, url);
			});
		});
	},
	blog: function(path, output_path_base, callback) {
		var width = 500;
		var new_temp_file_path = '/tmp/' + (new Date().getTime()) + '_blog.jpg';
		gm(path).autoOrient().noProfile().resize(width, null, '>').compress('JPEG').quality(90).write(new_temp_file_path, function () {
			module.exports.directUpload(new_temp_file_path, output_path_base, 'blog', function(err, url){
				if (err) return callback(err, null);
				callback(null, url);
			});
		});
	},
	large: function(path, output_path_base, callback) {
		var height = 1080;
		var width = 1920;
		var new_temp_file_path = '/tmp/' + (new Date().getTime()) + '_large.jpg';
		gm(path).autoOrient().noProfile().resize(width, height, '>').compress('JPEG').quality(90).write(new_temp_file_path, function () {
			module.exports.directUpload(new_temp_file_path, output_path_base, 'large', function(err, url){
				if (err) return callback(err, null);
				callback(null, url);
			});
		});
	},
	directUpload: function(path, output_path_base, suffix, callback){
		var image_extension = path.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|svg)$/)[1];
		var temp_headers = {
			'Content-Type' : 'image/' + image_extension,
			'x-amz-acl'    : 'public-read'
		};
		knox.putFile(path, output_path_base + suffix + '.' + image_extension, temp_headers, function (err, resp) {
			if (err) {
				return callback('S3 error: ' + err, null);
			} else if (resp.statusCode === 200 || resp.statusCode === 307) {
				callback(null, (resp.req ? resp.req.url : resp.url));
			} else {
				return callback('S3 error: status code = ' + resp.statusCode, null);
			}
		});

	}
};
