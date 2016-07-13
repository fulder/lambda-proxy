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
    response.end('Error 500: Missing function name.');
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


  let parameters = {};
  try {
    if (request.headers['lambda-proxy-parameters']) {
      parameters = JSON.parse(request.headers['lambda-proxy-parameters']);
      delete request.headers['lambda-proxy-parameters'];
    }
  } catch (error) {
    // console.log('Parameters is not a valid JSON-String:', request.headers['lambda-proxy-parameters']);
    response.writeHead(500);
    response.end('Error 500: Parameters is not a valid JSON-String.');
    return;
  }

  const scheme = request.headers['lambda-proxy-scheme'];
  if (functionName) {
    delete request.headers['lambda-proxy-scheme'];
  } else {
    response.writeHead(500);
    response.end('Error 500: Missing scheme.');
    return;
  }

  const host = request.headers['lambda-proxy-host'];
  if (functionName) {
    delete request.headers['lambda-proxy-host'];
  } else {
    response.writeHead(500);
    response.end('Error 500: Missing host.');
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

    // console.log(params);

    const lambda = new AWS.Lambda({
      region: region
    });

    lambda.invoke(params, (error, data) => {
      // console.log('---- RESPONSE ----');
      if (error) {
        response.writeHead(500);
        response.end('Error 500: ' + error.toString());
        return Promise.reject(error);
      } else if (data.FunctionError === 'Handled' || data.FunctionError === 'Unhandled') {
        // console.log(data);

        /* Lambda returns:
        { StatusCode: 200,
          FunctionError: 'Unhandled',
          Payload: '{"errorMessage":"Process exited before completing request"}'
        }
        */
        const errorMessage = JSON.parse(data.Payload).errorMessage;
        response.writeHead(500);
        response.end('Error 500: ' + errorMessage);
        return Promise.reject(errorMessage);
      } else {
        const lambdaResponse = JSON.parse(data.Payload);

        // console.log(data);
        // console.log(lambdaResponse.status);
        // console.log(lambdaResponse.headers);

        if (!lambdaResponse) {
          // this can happen, Lambda returns { StatusCode: 200, Payload: 'null' }
          // seen when using node-fetch with non-absolute url. Probable cause: unhandled exception in Promise
          response.writeHead(500);
          response.end('Error 500: No Payload');
          return Promise.reject('No Payload');
        } else if (!lambdaResponse.status) {
          response.writeHead(500);
          response.end('Error 500: Payload missing status property');
          return Promise.reject('Payload missing status property');
        } else {
          const headers = lambdaResponse.headers ? lambdaResponse.headers : {};
          const body = lambdaResponse.body ? lambdaResponse.body : '';

          response.writeHead(lambdaResponse.status.toString(), headers);
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
