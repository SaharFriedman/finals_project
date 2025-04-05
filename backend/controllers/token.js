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
const isLoggedIn = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Verify token
        const data =  await tokensService.verifyToken(token); 
        if (!data) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Attach user data to the request
        req.user = data;
        return next();

    } catch (error) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
};

module.exports = { createToken ,isLoggedIn};