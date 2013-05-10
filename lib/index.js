/**
 * Limit Requests Middleware
 *
 * @author Lei Zongmin<leizongmin@gmail.com>
 */

var debug = require('debug')('connect-limit-requests');
var utils = require('./utils');
var Client = require('./client');


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
  this.iptables = [];
  this._removeList = [];

  debug('Create new limiter: %s', JSON.stringify(options));

  this._nextTick();
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
  var iplong = utils.ip2long(ip);

  if (this.iptables[iplong]) return this.iptables[iplong];

  var client = new Client(ip, this);
  this.iptables[iplong] = client;

  return client;
};

/**
 * Add to remove list
 *
 * @param {String} ip
 */
Limiter.prototype.addToRemoveList = function (ip) {
  var iplong = utils.ip2long(ip);
  this._removeList.push(iplong);
};

/**
 * Remove the client instance
 *
 * @param {String|Number} ip
 */
Limiter.prototype.removeClient = function (ip) {
  var iplong = typeof ip === 'string' ? utils.ip2long(ip) : ip;
  var c = this.iptables[iplong];
  delete this.iptables[iplong];
  debug('Remove client: %s', c.ip);
};

/**
 * Next tick
 */
Limiter.prototype._nextTick = function () {
  var removeList = this._removeList;
  var iptables = this.iptables;

  if (!removeList) return;

  // 清空待删除的客户端列表
  for (var i = 0, len = removeList.length; i < len; i++) {
    var ip = removeList[i];
    if (iptables[ip] && iptables[ip].connections < 1) {
      this.removeClient(ip);
    }
  }

  debug('Limiter._nextTick...');
  this._nextTickTid = setTimeout(this._nextTick.bind(this), this.options.interval);
};

/**
 * Destory
 */
Limiter.prototype.destory = function () {
  var me = this;

  clearInterval(me._nextTickTid);

  Object.keys(me).forEach(function (k) {
    me[k] = null;
  });

  debug('Limiter has been destory.');
};
