//express is a library that helps us create a server.
const express = require('express');
//cors is a library that helps us enable cross-origin resource sharing i.e allow requests from other servers. 
const cors = require('cors');
//body-parser is a library that helps us parse the body of the request in a Json format.
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
//app is an instance of express.
var app = express();
//We are using the cors and bodyParser libraries.
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
//We are connecting to the mongodb database.
mongoose.connect('mongodb://127.0.0.1:27017/gardens');
//we create a route for the identify endpoint.
const signup = require('./routes/signup');
const token = require('./routes/token');
const {isLoggedIn}  = require('./controllers/token');
const gardenRoutes = require('./routes/gardenRoutes');
//we use the identify route as /identify.
app.use('/api/signup', signup);
app.use('/api/token', token);
app.use('/api',isLoggedIn ,gardenRoutes);

//for the frontend validation
app.get('/api/session', isLoggedIn, (req, res) => {
  res.json({ ok: true, user_id: req.userId });
});

const path = require("path");
app.use("/static/photos",
  express.static(path.join(process.cwd(), "uploads/photos"))
);
app.listen(12345 , () => {
    console.log('Server is running on port 12345');
});