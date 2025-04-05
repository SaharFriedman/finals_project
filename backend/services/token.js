const User = require('../models/user');
const jwt = require('jsonwebtoken'); 
const secretkey = "garden";
const createToken = async (req) =>{
    try{
        const {name,password} = req.body;
        const user = await User.findOne({name,password});
        return jwt.sign(user._id.toString(),secretkey);
    }
    catch(err){
        console.log(err);
        throw Object.assign(new Error('failed to get user'), { status: 400 });
    }
};
const verifyToken = (token) => {
    try{
         const decode = jwt.verify(token, secretkey);
        return decode;
    }catch(error){
        throw Object.assign(new Error(error.massage || 'Bad Request'), {status:error.status || 400});
    }
};
module.exports = { createToken, verifyToken};