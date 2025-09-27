const mongoose = require('mongoose');
const Schema = mongoose.Schema;
// saving the users 
const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});
module.exports = mongoose.model('User', userSchema);