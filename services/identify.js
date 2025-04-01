const User = require('../models/user');
const create = async (req,res) =>{
    try{
        const user = new User.create(req);
        return await user.save();
    }
    catch(err){
        return res.status(err.status).send(err.message);
    }
}
module.exports = { create };