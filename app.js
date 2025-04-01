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
app.use(express.json);
//We are connecting to the mongodb database.
mongoose.connect('mongodb://localhost:27017/identify', { useNewUrlParser: true });
//we create a route for the identify endpoint.
const identify = require('./routes/identify');
//we use the identify route as /identify.
app.use('/identify', identify);
app.listen(8080);