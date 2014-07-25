node-s3-multi-size-image
========================

Wow, what a terrible name. This is a Node.js module for automatically uploading an image in multiple sizes to S3 (for thumbnails, blogs, etc.). You supply it with a local image path, and it will split it up into a few different preset sizes, upload each of them, and return all their S3 URLs. You can also use it as a sort of CDN where you can use a single URL path to point to all the image sizes and differentiate between them with URL query strings (like image.jpg?size=thumb). See the usage notes for how you'd use this feature.

Important: Requires GraphicsMagick (in Debian, install with apt-get install graphicsmagick)

Usage
-------------------------
First install by putting the node-s3-multi-size-image.js file in your project directory or modules directory and make sure GraphicsMagick and all NPM dependencies (knox, async, gm) are installed
```
// Include module and initialize it with your S3 credentials:
var multiUploader = require(__dirname + '/node-s3-multi-size-image.js').initialize({
	s3_key: 'DFGSHFNDHJYUTRURBVD',
	s3_secret: 'sdfg67sh587v/byt76brt6rbty+8976dfgh8gsf96ffi',
	s3_bucket: 'bucket-name',
	s3_region: 'us-west-2',
});

//Using Express, your image upload function might look something like this:
app.post('/upload-image', cookieAuth, function(req, res){
	//Call the upload function which takes the local image path, an optional options object with what sizes you want to upload, and the callback:
	multiUploader.upload(req.files.imageupload.path, { sizes: ['thumb', 'small', 'blog', 'large', 'original'] }, function(err, file_names){
		//file_names is an object with all the S3 URLs of each image size
		console.log(file_names.thumb); // The S3 URL of the thumbnail version
		console.log(file_names.blog); // The S3 URL of the blog-sized (500px wide) version
		console.log(file_names.original); // The S3 URL of the original file with no compression

		//file_names also includes a redirect_base which you can use if you want to do dynamic image routing
		//It will look soemthing like 'msicdn_26563456345.jpg'
		res.send({ok: 'true', message: web_protocol + base_domain + '/image/' + file_names.redirect_base});
	});
});

//You can use the redirect_base and image_redirect function to dynamically route to different image sizes based on query strings
//In this example, the HTML would be like <img src="/image/msicdn_26563456345.jpg?size=thumb"> which would hit the following endpoint and redirect to the correct S3 URL
app.get('/image/:file_name', function (req, res) {
	if (!req.query || !req.query.size) req.query.size = 'large';
	multiUploader.image_redirect(req.params.file_name + '?size=' + req.query.size, function(err, url){
		//This will create the S3 URL based on the redirect_base the client is using as their image URL:
		return res.redirect(url);
	});
});
```

Notes
------------------------
It doesn't attempt to resize/edit/reformat gifs or svg files and will just fill in all returned URLs with a single unedited (original) upload URL
