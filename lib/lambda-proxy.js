'use strict';
/* jshint esversion: 6, node: true */

const AWS = require('aws-sdk');
const http = require('http');
const url = require('url');

const lambda = new AWS.Lambda({
  region: 'eu-west-1',
});

const server = http.createServer((request, response) => {

  // POST /2015-03-31/functions/FunctionName/invocations?Qualifier=Qualifier HTTP/1.1
  // X-Amz-Invocation-Type: InvocationType
  // X-Amz-Log-Type: LogType
  // X-Amz-Client-Context: ClientContext

  // Payload

  console.log('---- REQUEST ----');

  // console.log(request.headers);
  // console.log(url.parse(request.url, true));

  const functionName = request.headers['lp-function'];
  if (functionName) {
    delete request.headers['lp-function'];
  } else {
    response.writeHead(500);
    response.end('Missing function name.');
  }

  const qualifier = request.headers['lp-qualifier'];
  if (request.headers['lp-qualifier']) {
    delete request.headers['lp-qualifier'];
  }

  // TODO get region from header
  AWS.config.update({region: 'us-west-1'});

  const p = new Promise((resolve, reject) => {
    const chunks = [];

    request.on("end", function () {
      resolve(Buffer.concat(chunks));
    });

    request.on("data", function (chunk) {
      chunks.push(chunk);
    });
  });

  p.then((body) => {
      const params = {
        FunctionName: functionName,
        Qualifier: qualifier,
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: JSON.stringify({
          method: request.method,
          url: request.url,
          httpVersion: request.httpVersion,
          headers: request.headers,
          body: body.toString(),
        }),
      };

      lambda.invoke(params, (error, data) => {
        console.log('---- RESPONSE ----');
        if (error) {
          response.writeHead(500);
          response.end(error.toString());
          // throw new Error(error);
        } else {
          const lambdaResponse = JSON.parse(data.Payload);

          // console.log(lambdaResponse.status);
          // console.log(lambdaResponse.headers);

          const status = lambdaResponse.status ? lambdaResponse.status : '200';
          const headers = lambdaResponse.headers ? lambdaResponse.headers : {};
          const body = lambdaResponse.body ? lambdaResponse.body : '';

          response.writeHead(status.toString(), headers);
          response.end(body.toString());
        }
      });
  });


});

server.on('error', (err) => {
  throw err;
});

// TODO listen on localhost only
server.listen(8080, 'localhost', () => {
  const address = server.address();
  console.log('opened server on %j', address);
});
