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

describe('Test connect-refresh-limit middleware #2', function () {

  it('#refreshInterval', function (done) {
    
    var INTERVAL = 500;

    var app = express();
    app.use(me({
      proxy:            false,
      interval:         10000,
      limit:            10000,
      failureLimit:     0,
      refreshInterval:  INTERVAL,
      connections:      1000,
      callback: function (code, req, res, next) {
        code.should.equal(me.OVER_REFRESH_LIMIT);
        res.send(429, RESPONSE_TOO_MANY_REQUESTS);
      }
    }));
    
    app.get('/', function (req, res, next) {
      res.end(RESPONSE_OK);
    });

    expect(app, '/', 200, RESPONSE_OK, function () {
      expect(app, '/', 429, RESPONSE_TOO_MANY_REQUESTS, function () {
        setTimeout(function () {
          expect(app, '/', 200, RESPONSE_OK, function () {
            expect(app, '/', 429, RESPONSE_TOO_MANY_REQUESTS, function () {
              setTimeout(function () {
                expect(app, '/', 200, RESPONSE_OK, done);
              }, INTERVAL);
            })
          });
        }, INTERVAL);
      });
    });

  });
  
});
