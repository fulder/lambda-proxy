# Tutorial

This tutorial shows how to use Lambda-Proxy with an end-to-end example. The example is a simple form mailer.

The form mailer takes an HTML form and mails its contents to a fixed e-mail address.

(This is a minimal example. It is not intended for production use. )

First we need the form:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Example form</title>
  </head>
  <body>
  <form action="/lambda-proxy/formmailer" method="post">
    <input type="text" name="from" />
    <input type="text" name="subject" />
    <input type="text" name="message" />
    <input type="submit">
  </form>
  </body>
</html>
```

This HTML-file should be somewhere in your webroot where it can be accessed with a browser.

Then we need to configure our webserver to invoke the Lambda function upon form submit. Here are the relevant parts of the configuration file for nginx:

```
http {
  upstream lambda-proxy {
    server localhost:8080;
  }

  server {
    set $lambdaregion 'eu-west-1';

    proxy_set_header 'lambda-proxy-region' '$lambdaregion';
    proxy_set_header 'lambda-proxy-qualifier' '$lambdaqualifier';
    proxy_set_header 'lambda-proxy-function' '$lambdafunction';
    proxy_set_header 'lambda-proxy-parameters' '$lambdaparameters';
    proxy_set_header 'lambda-proxy-scheme' '$scheme';
    proxy_set_header 'lambda-proxy-host' '$host';

    location /lambda-proxy/formmailer {
      set $lambdafunction 'lambda-proxy-formmailer';
      set $lambdaparameters '{
                               "recipientEmail": "recipient@example.com",
                               "senderEmail": "\\\"Lambda Form Submit\\\" <recipient@example.com>",
                               "SESRegion": "eu-west-1"
                             }';
      proxy_pass http://lambda-proxy;
    }
  }
}
```

The `$lambdaparameters` variable contains JSON that configures from which email address the form data should be sent and where it goes. The Lambda function uses AWS SES to send the mail, so we need to indicate from which region we want to send the mail.

And of course we need the Lambda function:

```JavaScript
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
```

Create a new Lambda function with the name `lambda-proxy-formmailer` and give the IAM role assues the permission to send emails via SES. (Of course, you must have verified the `senderEmail` and `recipientEmail` in SES.)

That's it!
