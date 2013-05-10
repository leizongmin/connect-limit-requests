/**
 * Utils
 *
 * @author Lei Zongmin<leizongmin@gmail.com>
 */


/**
 * Convert IP address to number value
 * 
 * Examples:
 *    ip2long('192.0.34.166')    ==> 3221234342
 *    ip2long('255.255.255.256') ==> false
 *
 * @param {String} ip
 * @return {Number}
 */
exports.ip2long = function (ip) {
  var s = ip.split('.');
  var b = 256;
  if (s.length !== 4) return false;
  for (var i = 0; i < 4; i++) {
    var v = s[i] = parseInt(s[i], 10);
    if (v < 0 || v > 255) return false;
  }
  return s[0] * 16777216 + s[1] * 65536 + s[2] * 256 + s[3];
};
