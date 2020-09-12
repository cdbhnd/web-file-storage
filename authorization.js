var config = require('./config.json');

const authorizationMiddleware = (req, res, next) => {
    console.log(config);
    if (req.method !== 'GET' && req.method !== 'OPTIONS' && (!req.headers.authorization || req.headers.authorization !== 'API ' + config.api_key)) {
        res.sendStatus(401);
    }
    next();
};

module.exports = authorizationMiddleware;
