'use strict';
/* jshint esversion: 6, node: true */

exports.lambda = function(event, context, callback) {
  const result = {
    status: 200,
    headers: {'Content-Type': 'text/html'},
    body: '<html><head><title>Title</title></head><body><h1>Body</h1></body></html>'
  };
  callback(null, result);
};
