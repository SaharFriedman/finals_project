const Token = require('../services/token');
createToken = async (req,res) =>{
    try{
        const token = await Token.createToken(req);
        return res.json(token);
    }
    catch(err){
        return res.status(err.status).send(err.message);
    }
};
// controllers/token.js
const isLoggedIn = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const data = await Token.verifyToken(token); // string or object

    const userId = typeof data === 'string'
      ? data
      : data?.sub || data?.userId || data?.id || data?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.userId = userId;   // for the frontend
    req.user   = data;     // for the backend
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};


module.exports = { createToken ,isLoggedIn};