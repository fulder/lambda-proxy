'use strict';
/* jshint esversion: 6, node: true */

exports.lambda = function(event, context, callback) {
  throw new Error('Throwing an Error');
};
