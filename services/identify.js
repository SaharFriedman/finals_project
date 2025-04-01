const User = require('../models/user');
const create = async (req) =>{
    try{
        const user = new User(req.body);
        return await user.save();
    }
    catch(err){
        throw Object.assign(new Error('failed to save user'), { status: 400 });
    }
}
module.exports = { create };