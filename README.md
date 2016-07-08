# lambda-proxy
A HTTP proxy that invokes AWS Lambda functions.

Lambda Proxy makes it easy to invoke Lambda Functions directly from your webserver (Nginx, Apache, etc.)

## WORK IN PROGRESS
This is work in progress at this time. Use in production environments at your own risk. Comments, questions and contributions welcome.

## Installing

The preferred way to install the Lambda Proxy is to use the
[npm](http://npmjs.org) package manager for Node.js. Simply type the following
into a terminal window:

```sh
npm install -g lambda-proxy
```

## Running

Run the Lambda Proxy:

```sh
lambda-proxy
```

Run the Lambda Proxy in background:

```sh
lambda-proxy &
```

## Configuration

### Port

By default, Lambda Proxy listens on port 8080. To change that, use the `-port` flag:

```sh
lambda-proxy -port 8081 &
```

### Invocation

#### Lambda function name
#### Region
#### Credentials

## Lambda Input/Output structure

### Input: Lambda Event

The Lambda function is invoked with this data structure as the event.

```JavaScript
{
  method: 'GET | POST | ...',
  url: 'STRING_VALUE', // an url starting with "/", eg. "/some/url?with=parameter&s=attached"
  httpVersion: '1.0 | ...',
  headers: {
    'STRING_VALUE': 'STRING_VALUE', // 'headername': 'headervalue'
    /* more headers */
  },
  body: 'STRING_VALUE'
}
```

When the body is a JSON-Document, you must parse it yourself:

```JavaScript
JSON.parse(event.body);
```

### Output:

The Lambda Function must return a JSON document with this structure in the callback:

```JavaScript
{
  status: Number, // a valid NTTP status code
  headers: {
    'STRING_VALUE': 'STRING_VALUE', // 'headername': 'headervalue'
    /* more headers */
  },
  body: 'STRING_VALUE'
}
```

If you want to return an object as aJSON-document in the body, use `JSON.stringify':

```JavaScript
  body: JSON.stringify(object),
```

#### Example 1: Returning HTML

```JavaScript
const result = {
  status: 200,
  headers: {'Content-Type': 'text/html'},
  body: '<html><head><title>Title</title></head><body><h1>Body</h1></body></html>'
};
callback(null, result);
```
#### Example 2: Returning JSON
```JavaScript
const data = { key: 'value'};
const result = {
  status: 200,
  headers: {'Content-Type': 'text/json'},
  body: JSON.stringify(data),
};
callback(null, result);
```

#### Example 3: Errors

## Why?
Invoking AWS Lambda functions from an HTTP context currently requires using the AWS API Gateway. While the API Gateway is a good solution for REST-style APIs, its complex configuration makes it hard to use from a more document-oriented context.
This is a shame, because Lambda functions could become what PHP currently is: An easy way to add server-side scripting to websites in a serverless world.

The Lambda Proxy let's you skip the step of defining an API in API Gateway. Instead, you just proxy any HTTP request to the Lambda Proxy and it invokes the Lambda function for you. All configuration, e.g. which Lambda function to call, which AWS region to use etc. is configured in your webserver configuration. This removes any complexity between your webserver and the Lambda function.

## Security

The Lambda Proxy opens a configurable port. Whoever can send HTTP requests to this port can invoke all Lambda functions that can be invoked with the supplied AWS credentials. Therefore it is probably not a good idea to expose this port to the internet. By default, the Lambda Proxy listens on port `8080` on `localhost`.
