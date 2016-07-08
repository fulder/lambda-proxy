#!/usr/bin/env node

'use strict';
/* jshint esversion: 6, node: true */

const AWS = require('aws-sdk');
const http = require('http');

AWS.config.apiVersions = {
  lambda: '2015-03-31',
};

let port = 8080;
// get port from command line -port argument
if (process.argv.indexOf("-port") != -1) {
  port = Number.parseInt(process.argv[process.argv.indexOf("-port") + 1]);
}

function handleRequest(request, response) {
  // console.log('---- REQUEST ----');

  // console.log(request.headers);

  // parse configuration headers
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

  const region = request.headers['lp-region'];
  if (request.headers['lp-region']) {
    delete request.headers['lp-region'];
    AWS.config.update({region: region});
  }

  // prepare to read request body
  const readRequestBody = new Promise((resolve, reject) => {
    const chunks = [];

    request.on("end", function () {
      resolve(Buffer.concat(chunks));
    });

    request.on("data", function (chunk) {
      chunks.push(chunk);
    });
  });

  const invokeLambdaFunction = function(body) {
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

    const lambda = new AWS.Lambda({
      region: region
    });

    lambda.invoke(params, (error, data) => {
      // console.log('---- RESPONSE ----');
      if (error) {
        response.writeHead(500);
        response.end('Error 500: ' + error.toString());
        return Promise.reject(error);
      } else {
        const lambdaResponse = JSON.parse(data.Payload);

        // console.log(lambdaResponse.status);
        // console.log(lambdaResponse.headers);

        if (data.FunctionError === 'Handled' || data.FunctionError === 'Unhandled') {
          response.writeHead(500);
          response.end('Error 500: ' + lambdaResponse.errorMessage);
          return Promise.reject(lambdaResponse.errorMessage);
        } else {
          const status = lambdaResponse.status ? lambdaResponse.status : '200';
          const headers = lambdaResponse.headers ? lambdaResponse.headers : {};
          const body = lambdaResponse.body ? lambdaResponse.body : '';

          response.writeHead(status.toString(), headers);
          response.end(body.toString());
          return Promise.resolve();
        }
      }
    });
  };

  //read request body, then invoke lambda function
  readRequestBody.then(invokeLambdaFunction);
}

const server = http.createServer(handleRequest);

server.on('error', (err) => {
  throw err;
});

// TODO listen on localhost only
server.listen(port, 'localhost', () => {
  const address = server.address();
  console.log('opened server on %j', address);
});
