const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.set('WWW-Authenticate', 'Bearer realm="iam"');
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    req.principal = jwt.verify(token, process.env.JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
      audience: 'iam-api',
    });
    return next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token';
    res.set('WWW-Authenticate', `Bearer error="${code}"`);
    return res.status(401).json({ error: code });
  }
}

function requireScope(scope) {
  return (req, res, next) => {
    const granted = (req.principal.scope || '').split(' ');
    if (!granted.includes(scope)) {
      return res.status(401).json({ error: 'insufficient_scope', required: scope });
    }
    return next();
  };
}

module.exports = { authenticate, requireScope };
