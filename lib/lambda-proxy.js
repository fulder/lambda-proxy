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
  const functionName = request.headers['lambda-proxy-function'];
  if (functionName) {
    delete request.headers['lambda-proxy-function'];
  } else {
    response.writeHead(500);
    response.end('Missing function name.');
    return;
  }

  const qualifier = request.headers['lambda-proxy-qualifier'];
  if (request.headers['lambda-proxy-qualifier']) {
    delete request.headers['lambda-proxy-qualifier'];
  }

  const region = request.headers['lambda-proxy-region'];
  if (request.headers['lambda-proxy-region']) {
    delete request.headers['lambda-proxy-region'];
    AWS.config.update({region: region});
  }

  const parameters = request.headers['lambda-proxy-parameters'];
  if (request.headers['lambda-proxy-parameters']) {
    delete request.headers['lambda-proxy-parameters'];
    try {
      JSON.parse(parameters);
    } catch (error) {
      response.writeHead(500);
      response.end('Parameters is not a valid JSON-String.');
      return;
    }
  }

  const scheme = request.headers['lambda-proxy-scheme'];
  if (functionName) {
    delete request.headers['lambda-proxy-scheme'];
  } else {
    response.writeHead(500);
    response.end('Missing scheme.');
    return;
  }

  const host = request.headers['lambda-proxy-host'];
  if (functionName) {
    delete request.headers['lambda-proxy-host'];
  } else {
    response.writeHead(500);
    response.end('Missing host.');
    return;
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
        scheme: scheme,
        host: host,
        url: request.url,
        httpVersion: request.httpVersion,
        parameters: parameters,
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
