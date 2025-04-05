const User = require('../services/signup');
signUp = async (req,res) =>{
    try{
        const user = await User.create(req);
        return res.json(user);
    }
    catch(err){
        return res.status(err.status).send(err.message);
    }
}

module.exports = { signUp };