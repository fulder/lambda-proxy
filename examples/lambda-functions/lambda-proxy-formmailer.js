'use strict';
/* jshint esversion: 6, node: true */

const querystring = require('querystring');
const AWS = require('aws-sdk');

exports.lambda = function(event, context, callback) {
  // parse parameters
  const senderEmail = event.parameters.senderEmail;
  const SESRegion = event.parameters.SESRegion;
  const recipientEmail = event.parameters.recipientEmail;

  // parse querystring from body
  const query = querystring.parse(event.body);
  const from = query.from;
  const subject = query.subject;
  const message = query.message;

  // send email
  var params = {
    Destination: {
      ToAddresses: [ recipientEmail ]
    },
    Message: {
      Subject: {
        Data: 'Web form submit: ' + subject,
        Charset: 'UTF-8'
      },
      Body: {
        Text: {
          Data: 'From: ' + from + '\n\n' + message,
          Charset: 'UTF-8'
        }
      }
    },
    Source: senderEmail
  };

  const ses = new AWS.SES({region: SESRegion});
  ses.sendEmail(params, function(error, data) {
    if (error) {
      throw new Error(error);
    } else {
      // prepare result
      const result = {
        status: 200,
        headers: {'Content-Type': 'text/html; charset=utf-8'},
        body: '<html><head><title>Form submit successfull</title></head><body><h1>The form has been sent.</h1></body></html>',
      };
      callback(null, result);
    }
  });
};
