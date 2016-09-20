'use strict';
/* jshint esversion: 6, node: true */

exports.lambda = function(event, context, callback) {
  const result = {
    status: 200,
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ event: event }),
  };
  callback(null, result);
};
