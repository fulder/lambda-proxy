# lambda-proxy
A HTTP proxy that invokes AWS Lambda functions.

Lambda Proxy makes it easy to invoke Lambda Functions directly from your webserver (Nginx, Apache, etc.)

## WORK IN PROGRESS
This is work in progress at this time. Use in production environments at your own risk. Incompatible changes may be introduced. Comments, questions and contributions welcome.

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
### Credentials
Lambda Proxy requires a set of AWS credentials that are authorized to invoke the Lambda functions.

#### With the Shared Credentials File
The easiest way to provide these credentials is via a Shared Credentials File. This file needs to be located in your home directory: `~/.aws/credentials`. It contains the credentials:

```
[default]
aws_access_key_id = <YOUR_ACCESS_KEY_ID>
aws_secret_access_key = <YOUR_SECRET_ACCESS_KEY>
```

More information can be found in the [AWS documentation](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Credentials_from_the_Shared_Credentials_File_____aws_credentials_)

#### With environment variables

You can set your credentials in the environment variables
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

More information can be found in the [AWS documentation](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Credentials_from_Environment_Variables)

All other configuration is sent with the individual requests.

### Invocation

A Lambda function is invoked, when an HTTP-request is sent to the Lambda Proxy. Configuration for the invocation is sent via HTTP headers.

#### Lambda function
##### Lambda function name
The HTTP header `lambda-proxy-function` defines the Lambda function to invoke. You can specify a function name (e.g. `lambda-proxy-echo`) or you can specify an Amazon Resource Name (ARN) of the function (e.g. `arn:aws:lambda:eu-west-1:account-id:function:lambda-proxy-echo`).

##### Qualifier
The qualifier for the Lambda function is set via the `lambda-proxy-qualifier` HTTP header. If this header is not present, empty or set to `$LATEST`, the latest version of the Lambda function is invoked. If it contains a version number or an alias for a Lambda function, the indicated Lambda function is invoked.

##### Region
The region in which the Lambda function is defined is indicated with the HTTP header `lambda-proxy-region`.

### Meta-Information for the request
The Lambda function needs some meta information to handle the request, specifically the scheme and host that were used for the initial request. This allows the Lambda function for example to create correct absolute links.

#### Scheme
The scheme is indicated with the `lambda-proxy-scheme` HTTP header.

#### Host
The host is indicated with the `lambda-proxy-host` HTTP header.

#### URL
The URL is taken directly from the request to the Lambda Proxy and does not need to be specifically configured.


### Minimal Nginx configuration:
```
location /some/location/ {
  proxy_set_header 'lambda-proxy-region' 'eu-west-1';
  proxy_set_header 'lambda-proxy-function' 'lambda-proxy-echo';
  proxy_set_header 'lambda-proxy-parameters' '';
  proxy_set_header 'lambda-proxy-scheme' '$scheme';
  proxy_set_header 'lambda-proxy-host' '$host';
  proxy_pass http://localhost:8080;
}
```

To avoid unneccessary repetition, it is recommended to move the `proxy_set_header`-directives to the `server` context and use variables to overwrite values selectively:

```
  server {
    set $lambdaregion 'eu-west-1';

    proxy_set_header 'lambda-proxy-region' '$lambdaregion';
    proxy_set_header 'lambda-proxy-qualifier' '$lambdaqualifier';
    proxy_set_header 'lambda-proxy-function' '$lambdafunction';
    proxy_set_header 'lambda-proxy-parameters' '$lambdaparameters';
    proxy_set_header 'lambda-proxy-scheme' '$scheme';
    proxy_set_header 'lambda-proxy-host' '$host';

    location /some/location {
      set $lambdafunction 'lambda-proxy-echo';
      proxy_pass http://localhost:8080;
    }
  }
```

Note: If you use an additional `proxy_set_header`-directive inside a `location`-block, nginx discards all `proxy_set_header`-directives defined outside of the `location`-block, therefore you need to repeat all of them in this case.

### Extended Nginx configuration example
This configuration leverages more of the nginx configuration directives and also changes the request method and sets a custom body.
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

    location /some/location {
      set $lambdafunction 'lambda-proxy-echo';
      proxy_pass http://lambda-proxy;
    }

    location /some/other/location {
      set $lambdafunction 'lambda-proxy-echo';
      set $lambdaqualifier 'PROD'; # the qualifier for the Lambda function, use an empty string '' for $LATEST (because $ can not get escaped in the nginx configuration)
      set $lambdaparameters '{"real_ip": "$realip_remote_addr"}';
      proxy_method POST; # switch the request to POST to send custom body
      proxy_set_body '{ "some": "json" }'; # set a custom JSON body with nginx variables
      proxy_pass http://lambda-proxy;
    }
  }
}
```

### Minimal Apache configuration
TBD

## Lambda Input/Output structure
The Input/Output structure is defined in the HTTP-Lambda Gateway Protocol. (TBD)

### Input: Lambda Event
The Lambda function is invoked with this data structure as the event.

```JavaScript
{
  method: 'GET | POST | ...',
  scheme: 'http | https | ...',
  host: 'STRING_VALUE', // the originally requested host
  url: 'STRING_VALUE', // the request url, starting with "/", eg. "/some/url?with=parameter&s=attached"
  httpVersion: '1.0 | ...',
  parameters: 'JSON_STRING_VALUE',
  headers: {
    'STRING_VALUE': 'STRING_VALUE', // 'headername': 'headervalue'
    /* more headers */
  },
  body: 'STRING_VALUE'
}
```

The value of *parameters* must be a valid JSON String.

The difference between *headers*/*body* and *parameters* is that `headers` and `body` may contain unchecked content that a malicious client sent, whereas `parameters` represents content that was added by the server that invokes the Lambda function. In terms of responsibility, the Lambda function is responsible for securely parsing, sanitizing and handling `header` and `body` values. On the other hand the Lambda function can treat the value of `parameters` as having been scrutinized by the server that invokes the Lambda version.

When the *body* is a JSON-Document, you must parse it yourself:

```JavaScript
JSON.parse(event.body);
```

### Output:
The Lambda Function must return a JSON document with this structure in the callback:

```JavaScript
{
  status: Number, // a valid HTTP status code
  headers: {
    'STRING_VALUE': 'STRING_VALUE', // 'headername': 'headervalue'
    /* more headers */
  },
  body: 'STRING_VALUE'
}
```

If you want to return an object as a JSON-document in the body, use `JSON.stringify':

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
If the output from the Lambda function does not conform to the HTTP-Lambda Gateway Protocol, the response is an HTTP status code 500 with an error message in the body.

## Why?
Invoking AWS Lambda functions from an HTTP context currently requires using the AWS API Gateway. While the API Gateway is a good solution for REST-style APIs, its complex configuration makes it hard to use from a more document-oriented context.
This is a shame, because Lambda functions could become what PHP currently is: An easy way to add server-side scripting to websites in a serverless world.

The Lambda Proxy let's you skip the step of defining an API in API Gateway. Instead, you just proxy any HTTP request to the Lambda Proxy and it invokes the Lambda function for you. All configuration, e.g. which Lambda function to call, which AWS region to use etc. is configured in your webserver configuration. This removes any complexity between your webserver and the Lambda function.

## Security
The Lambda Proxy opens a configurable port. Whoever can send HTTP requests to this port can invoke all Lambda functions that can be invoked with the supplied AWS credentials. Therefore it is probably not a good idea to expose this port to the internet. By default, the Lambda Proxy listens on port `8080` on `localhost`.
