function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (forwardedFor) {
    const forwardedIp = String(forwardedFor).split(',')[0].trim();
    if (forwardedIp) return forwardedIp;
  }

  const directIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (!directIp) return null;

  return String(directIp).replace(/^::ffff:/, '');
}

function getDeviceInfo(userAgent = '') {
  const ua = String(userAgent).toLowerCase();

  if (!ua) {
    return {
      browser: null,
      deviceInfo: null,
      operatingSystem: null,
    };
  }

  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

  let operatingSystem = 'Unknown';
  if (ua.includes('windows nt')) operatingSystem = 'Windows';
  else if (ua.includes('android')) operatingSystem = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) operatingSystem = 'iOS';
  else if (ua.includes('mac os x') || ua.includes('macintosh')) operatingSystem = 'macOS';
  else if (ua.includes('linux')) operatingSystem = 'Linux';

  let deviceInfo = 'Desktop';
  if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceInfo = 'Tablet';
  } else if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    deviceInfo = 'Mobile';
  }

  return {
    browser,
    deviceInfo,
    operatingSystem,
  };
}

function buildRequestMeta(req) {
  const userAgent = req.get('user-agent') || '';
  const deviceInfo = getDeviceInfo(userAgent);

  return {
    ip_address: getClientIp(req),
    device_info: deviceInfo.deviceInfo,
    browser: deviceInfo.browser,
    operating_system: deviceInfo.operatingSystem,
    user_agent: userAgent || null,
  };
}

module.exports = {
  buildRequestMeta,
  getClientIp,
  getDeviceInfo,
};
