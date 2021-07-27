var config = require('./config.json');

const authorizationMiddleware = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'OPTIONS' && (!req.headers.authorization || req.headers.authorization !== 'API ' + config.api_key)) {
        return res.sendStatus(401);
    }
    next();
};

module.exports = authorizationMiddleware;
