/**
 * Limit Requests Middleware
 *
 * @author Lei Zongmin<leizongmin@gmail.com>
 */

var debug = require('debug')('connect-limit-requests');

exports = module.exports = Client;


/**
 * Client
 *
 * @param {String} ip
 * @param {Object} parent
 */
function Client (ip, parent) {
  var now = Date.now();

  this._lastId = 0;
  this.ip = ip;                   // 客户IP地址
  this.connections = 0;           // 连接数量
  this.requests = 0;              // 某段时间内的请求数量
  this.intervalStart = now;       // “某段时间”的统计起始时间
  this.faileds = 0;               // 某段时间内非200的请求数量
  this.lastVisited = now;         // 最后一次访问时间
  this.paths = {};                // 访问路径最后访问时间Map

  this.parent = parent;

  debug('New client: %s', ip);
}

/**
 * Remove
 */
Client.prototype.remove = function () {
  this.parent.addToRemoveList(this.ip);
};

/**
 * Assign unique ID
 *
 * @return {Number}
 */
Client.prototype.assignUniqueId = function () {
  this._lastId++;
  return this._lastId;
};

/**
 * Request
 */
Client.prototype.request = function () {
  this.lastVisited = Date.now();
};

/**
 * Check request limit
 *
 * @param {Object} options
 * @param {Object} req
 * @param {Object} res
 * @return {Boolean}
 */
Client.prototype.checkRequestLimit = function (options, req, res) {
  var id = req.connection.__crlimit_id;
  var now = this.lastVisited;

  this.requests++;

  // 检查指定时间段内的请求数量
  if (now - this.intervalStart >  options.interval) {
    this.intervalStart = now;
    this.requests = 1;
    this.faileds = 0;
    debug('Reset counter on %s', req.__crlimit_ip);
    return false;
  } else {
    return this.requests > options.limit;
  }
};

/**
 * Check connection limit
 *
 * @param {Object} options
 * @param {Object} req
 * @param {Object} res
 * @return {Boolean}
 */
Client.prototype.checkConnectionLimit = function (options, req, res) {
  var conn = req.connection;
  var me = this;

  // 同一IP连接计数
  if (isNaN(conn.__crlimit_id)) {
    conn.__crlimit_id = this.assignUniqueId();
    me.connections++;
    debug('New connection from %s, total %d', req.__crlimit_ip, me.connections);
    conn.once('close', function () {
      me.connections--;
      debug('Connection close from %s, total %d', req.__crlimit_ip, me.connections);
      if (me.connections < 1) me.remove();
    });
  }

  return me.connections > options.connections;
};

/**
 * Check Malicious refresh 
 *
 * @param {Object} options
 * @param {Object} req
 * @param {Object} res
 * @return {Boolean}
 */
Client.prototype.checkRefreshLimit = function (options, req, res) {
  var p = req.__crlimit_path;
  var now = this.lastVisited;

  // 同一请求路径时间间隔（不区分问号?后面部分）
  var last = this.paths[p];
  this.paths[p] = now;
  
  return last > 0 && now - last <= options.refreshInterval;
};

/**
 * Check traversal attack
 *
 * @param {Object} options
 * @param {Object} req
 * @param {Object} res
 * @return {Boolean}
 */
Client.prototype.checkFailureLimit = function (options, req, res) {
  var me = this;

  // 短时间内大量非 200/304 响应的请求
  res.once('finish', function () {
    if (res.statusCode !== 200 && res.statusCode !== 304) {
      me.faileds++;
      debug('Cannot complete the request from %s, total %d', req.__crlimit_ip, me.faileds);
    }
  });

  return me.faileds >= options.failureLimit;
};
