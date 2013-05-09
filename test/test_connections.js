/**
 * Tests
 *
 * @author Lei Zongmin<leizongmin@gmail.com>
 */

var events = require('events');
var util = require('util');
var express = require('express');
var should = require('should');
var supertest = require('supertest');
var brightFlow = require('bright-flow');
var me = require('../');

var RESPONSE_TOO_MANY_REQUESTS = 'Too Many Requests'; 
var RESPONSE_OK = 'OK';
var RESPONSE_NOT_FOUND = 'Not Found';

function expect (app, path, status, body, done) {
  return supertest(app).get(path).expect(status, body).end(function (err, res) {
    if (err) throw err;
    //console.log(res.text);
    done();
  })
}

describe('Test connect-refresh-limit middleware #4', function () {

  function Request (url, address) {
    this.url = url;
    this.headers = {};
    this.connection = new Connection(address);
  }
  util.inherits(Request, events.EventEmitter);

  function Connection (address) {
    this.remoteAddress = address;
  }
  util.inherits(Connection, events.EventEmitter);
  Connection.prototype.close = function () {
    this.emit('close');
  };

  function Response (done) {
    this.done = done;
    this.statusCode = 200;
    this.data = '';
  }
  util.inherits(Response, events.EventEmitter);
  Response.prototype.end = function (data) {
    this.data = data;
    this.done(this.statusCode, this.data);
    this.emit('finish');
  };

  it('#connections', function (done) {

    var INTERVAL = 500;

    var limit = new me.Limiter({
      proxy:            false,
      interval:         INTERVAL,
      limit:            10000,
      failureLimit:     10000,
      refreshInterval:  0,
      connections:      2,
      callback: function (code, req, res, next) {
        code.should.equal(me.OVER_CONNECTION_LIMIT);
        res.statusCode= 429;
        res.end(RESPONSE_TOO_MANY_REQUESTS);
      }
    });
    var handle = limit.getHandle();

    function test (done) {
      var req = new Request('/', '127.0.0.1');
      var res = new Response(done);
      setTimeout(function () {
        handle(req, res, function () {
          res.end(RESPONSE_OK);
        });
      }, 100);
      return req.connection;
    }

    var c1 = test(function (statusCode, body) {
      statusCode.should.equal(200);
      body.should.equal(RESPONSE_OK);

      var c2 = test(function (statusCode, body) {
        statusCode.should.equal(200);
        body.should.equal(RESPONSE_OK);

        var c3 = test(function (statusCode, body) {
          statusCode.should.equal(429);
          body.should.equal(RESPONSE_TOO_MANY_REQUESTS);
          
          var c4 = test(function (statusCode, body) {
            statusCode.should.equal(429);
            body.should.equal(RESPONSE_TOO_MANY_REQUESTS);

            c1.close();
            c2.close();
            c3.close();

            var c5 = test(function (statusCode, body) {
              statusCode.should.equal(200);
              body.should.equal(RESPONSE_OK);
              
              c4.close();
              c5.close();

              // 自动删除客户端实例
              setTimeout(function () {
                Object.keys(limit.iptables).length.should.equal(0);
                done();
              }, INTERVAL * 1.2);

            });
          });
        });
      });
    });

  });

});