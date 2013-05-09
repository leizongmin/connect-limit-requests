/**
 * Refresh Limit Middleware
 *
 * @author Lei Zongmin<leizongmin@gmail.com>
 */

var debug = require('debug')('connect-refresh-limit');


/**
 * Create a limiter middleware
 *
 * @param {Object} options
 * @return {Function}
 */
exports = module.exports = function (options) {
  var limit = new Limiter(options);
  return limit.getHandle();
};

var OVER_REQUEST_LIMIT = exports.OVER_REQUEST_LIMIT = 1;        // 超过请求数量限制
var OVER_CONNECTION_LIMIT = exports.OVER_CONNECTION_LIMIT = 2;  // 超过连接数量限制
var OVER_REFRESH_LIMIT = exports.OVER_REFRESH_LIMIT = 3;        // 恶意刷新
var OVER_FAILURE_LIMIT = exports.OVER_FAILURE_LIMIT = 4;        // 超过出错数量限制

exports.Limiter = Limiter;
exports.Client = Client;

/******************************************************************************/

function booleanValue(v, d) {
  return !!(typeof v === 'undefined' ? d : v);
}

function numberValue (v, d) {
  return Number(v >= 0 ? v: d);
}

function defaultCallback (code, req, res, next) {
  res.statusCode = 429;
  res.end('Too Many Requests.');
}

/******************************************************************************/

/**
 * Limiter
 *
 * @parma {Object} options
 *  - {Boolean} proxy           是否来自代理服务器，如果是，代理服务器必须传递请求头 X-Real-IP 请求头来指定客户端的IP
 *                              默认为false
 *  - {Number} interval         限制同一IP的请求数量时间间隔，默认为30,000ms
 *  - {Number} limit            限制同一IP的请求数量请求数量，默认为1000
 *  - {Number} failureLimit     限制同已IP的错误请求数量（非200和304响应），默认为50
 *  - {Number} refreshInterval  同一页面检测刷新时间间隔，默认为1000ms
 *  - {Number} connections      限制同已IP的连接数量，默认为100
 *  - {Function} callback       当被检查为恶意刷新时的回调函数，默认返回HTTP 429 Too Many Requests 
 */
function Limiter (options) {
  options = typeof options === 'undefined' ? {} : options;
  if (!options && typeof options !== 'object') {
    throw new Error('The first argument must be an object.');
  }
  options.proxy = booleanValue(options.proxy, false);
  options.failureLimit = numberValue(options.failureLimit, 50);
  options.refreshInterval = numberValue(options.refreshInterval, 1000);
  options.interval = numberValue(options.interval, 30000);
  options.limit = numberValue(options.limit, 1000);
  options.connections = numberValue(options.connections, 100);
  options.callback = typeof options.callback === 'function' ? options.callback : defaultCallback;

  this.options = options;
  this.iptables = {};

  debug('Create new limiter: %s', JSON.stringify(options));
}

/**
 * Get Handle
 */
Limiter.prototype.getHandle = function () {
  var me = this;
  var options = me.options;

  return function (req, res, next) {
    
    var ip = options.proxy ? req.headers['x-real-ip'] : req.connection.remoteAddress;
    req.__crlimit_ip = ip;
    var client = me.getClient(ip);

    var i = req.url.indexOf('?');
    req.__crlimit_path = i === -1 ? req.url : req.url.substr(0, i);

    client.request();
    debug('New request from %s, path %s', ip, req.__crlimit_path);

    // 检查是否超过连接数量限制
    if (client.checkConnectionLimit(options, req, res)) {
      debug('Over connection limit: %s', ip);
      return options.callback(OVER_CONNECTION_LIMIT, req, res, next);
    }

    // 检查是否超过请求数量限制
    if (client.checkRequestLimit(options, req, res)) {
      debug('Over request limit: %s', ip);
      return options.callback(OVER_REQUEST_LIMIT, req, res, next);
    }

    // 检测恶意刷新同一页面限制
    if (options.refreshInterval > 0 && client.checkRefreshLimit(options, req, res)) {
      debug('Over refresh limit: %s', ip);
      return options.callback(OVER_REFRESH_LIMIT, req, res, next);
    }

    // 检测是否超过错误数量限制
    if (options.failureLimit > 0 && client.checkFailureLimit(options, req, res)) {
      debug('Over failure limit: %s', ip);
      return options.callback(OVER_FAILURE_LIMIT, req, res, next);
    }

    // 正常请求
    return next();
  };
};

/**
 * Return the client instance
 *
 * @param {String} ip
 * @return {Object}
 */
Limiter.prototype.getClient = function (ip) {
  if (this.iptables[ip]) return this.iptables[ip];

  var client = new Client(ip, this);
  this.iptables[ip] = client;

  return client;
};

/**
 * Remove the client instance
 *
 * @param {String} ip
 */
Limiter.prototype.removeClient = function (ip) {
  delete this.iptables[ip];
  debug('Remove client: %s', ip);
};

/******************************************************************************/

/**
 * Client
 *
 * @param {String} ip
 * @param {Object} parent
 */
function Client (ip, parent) {
  var now = Date.now();

  this._lastId = 0;
  this.ip = ip;               // 客户IP地址
  this.connections = 0;       // 连接数量
  this.requests = 0;          // 某段时间内的请求数量
  this.intervalStart = now;   // “某段时间”的统计起始时间
  this.faileds = 0;           // 某段时间内非200的请求数量
  this.lastVisited = now;     // 最后一次访问时间
  this.paths = {};            // 访问路径最后访问时间Map

  this.parent = parent;

  debug('New client: %s', ip);
}

/**
 * Remove
 */
Client.prototype.remove = function () {
  var me = this;
  var parent = me.parent;
  setTimeout(function () {
    if (me.connections < 1) {
      parent.removeClient(me.ip);
    }
  }, parent.options.interval);
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
